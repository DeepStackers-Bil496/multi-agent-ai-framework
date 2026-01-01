import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { AgentUserRole, ON_CHAT_MODEL_STREAM_EVENT, TOOL_STARTED, TOOL_ENDED, TOOL_STARTED_EVENT, TOOL_ENDED_EVENT, AGENT_STARTED, AGENT_STREAM, AGENT_ERROR, AGENT_ENDED } from "@/lib/constants";
import { AgentChatMessage, LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { EmailAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllEmailAgentTools } from "./tools";

class EmailAgent extends BaseAgent<LLMImplMetadata> {
    constructor(emailAgentConfig: AgentConfig<LLMImplMetadata>) {
        super(emailAgentConfig);

        this.agentTools = createAllEmailAgentTools();

        console.log(`[EmailAgent] Initializing with provider: ${this.implementationMetadata.provider}`);
        const llm = this.createLLMFromConfig();
        this.agentLLM = llm.bindTools!(this.agentTools);

        const toolNode = new ToolNode(this.agentTools);

        const emailAgentGraph = new StateGraph(MessagesAnnotation)
            .addNode("EmailAgentNode", this.agentNode.bind(this))
            .addNode("tools", toolNode)
            .addEdge(START, "EmailAgentNode")
            .addConditionalEdges("EmailAgentNode", this.EmailAgentRoute.bind(this))
            .addEdge("tools", "EmailAgentNode");

        this.agentGraph = emailAgentGraph.compile();
        console.log("[EmailAgent] Initialized successfully");
    }

    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.implementationMetadata.systemInstruction),
            ...messages,
        ];

        try {
            const response = await this.agentLLM!.invoke(messagesToSend);
            const aiResponse = response as AIMessage;

            if (!aiResponse.content && (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0)) {
                return {
                    messages: [new AIMessage("I couldn't generate a response. Please try again.")],
                };
            }

            return { messages: [response] };
        } catch (error) {
            console.error("[EmailAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
        }
    }

    private EmailAgentRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }

        return "tools";
    }

    public async run(inputMessages: AgentChatMessage[]): Promise<Response> {
        const history = inputMessages.map((message) =>
            message.role == AgentUserRole
                ? new HumanMessage(message.content)
                : new AIMessage(message.content)
        );

        const eventStream = this.agentGraph!.streamEvents(
            { messages: history },
            { version: "v2" }
        );

        const agentName = this.name;
        const agentId = this.id;

        const encoder = new TextEncoder();
        const responseStream = new ReadableStream({
            async start(controller) {
                const enqueueJson = (data: object) => {
                    const json = JSON.stringify(data) + "\n";
                    controller.enqueue(encoder.encode(json));
                };

                try {
                    enqueueJson({
                        type: AGENT_STARTED,
                        payload: {
                            name: agentName,
                            content: JSON.stringify(inputMessages),
                            id: agentId,
                        },
                    });

                    for await (const event of eventStream) {
                        if (event.event === TOOL_STARTED_EVENT && event.name === "tools") {
                            let toolName = "email_tool";
                            const inputMsgs = event.data.input?.messages;
                            if (inputMsgs && inputMsgs.length > 0) {
                                const lastMsg = inputMsgs[inputMsgs.length - 1];
                                if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
                                    toolName = lastMsg.tool_calls[0].name;
                                }
                            }

                            enqueueJson({
                                type: TOOL_STARTED,
                                payload: {
                                    name: toolName,
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id,
                                },
                            });
                        } else if (event.event === TOOL_ENDED_EVENT && event.name === "tools") {
                            let toolName = "email_tool";
                            let output = event.data.output;
                            if (output?.messages?.length > 0) {
                                const toolMsg = output.messages[output.messages.length - 1];
                                if (toolMsg.name) {
                                    toolName = toolMsg.name;
                                }
                                output = toolMsg.content;
                            }

                            enqueueJson({
                                type: TOOL_ENDED,
                                payload: {
                                    name: toolName,
                                    content: JSON.stringify(output),
                                    id: event.run_id,
                                },
                            });
                        } else if (event.event === ON_CHAT_MODEL_STREAM_EVENT) {
                            enqueueJson({
                                type: AGENT_STREAM,
                                payload: {
                                    name: event.name,
                                    content: event.data.chunk,
                                    id: event.run_id,
                                },
                            });
                        }
                    }
                } catch (error) {
                    console.error("[EmailAgent] CRITICAL ERROR:", error);
                    enqueueJson({
                        type: AGENT_ERROR,
                        payload: {
                            name: agentName,
                            content: error instanceof Error ? error.message : "Unknown error",
                            id: agentId,
                        },
                    });
                } finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: {
                            name: agentName,
                            content: "",
                            id: agentId,
                        },
                    });
                    controller.close();
                }
            },
        });

        return new Response(responseStream, {
            headers: { "Content-Type": "application/json", charset: "utf-8" },
        });
    }
}

export const emailAgent = new EmailAgent(EmailAgentConfig);
