import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR } from "@/lib/constants";
import { AgentChatMessage, LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { WebAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllWebAgentTools } from "./tools";

class WebAgent extends BaseAgent<LLMImplMetadata> {

    constructor(webAgentConfig: AgentConfig<LLMImplMetadata>) {
        super(webAgentConfig);

        this.agentTools = createAllWebAgentTools();

        // Use factory method to create LLM based on config provider
        console.log(`[WebAgent] Initializing with provider: ${this.implementationMetadata.provider}`);
        const llm = this.createLLMFromConfig();
        this.agentLLM = llm.bindTools!(this.agentTools);

        const toolNode = new ToolNode(this.agentTools);

        const webAgentGraph = new StateGraph(MessagesAnnotation)
            .addNode("WebAgentNode", this.agentNode.bind(this))
            .addNode("tools", toolNode)
            .addEdge(START, "WebAgentNode")
            .addConditionalEdges("WebAgentNode", this.WebAgentRoute.bind(this))
            .addEdge("tools", "WebAgentNode");

        this.agentGraph = webAgentGraph.compile();
        console.log("[WebAgent] Initialized successfully");
    }

    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.implementationMetadata.systemInstruction),
            ...messages
        ];

        try {
            console.log("[WebAgent] Invoking LLM with", messages.length, "messages");
            const response = await this.agentLLM!.invoke(messagesToSend);

            const aiResponse = response as AIMessage;
            console.log("[WebAgent] Response received:", {
                hasContent: !!aiResponse.content,
                hasToolCalls: !!(aiResponse.tool_calls && aiResponse.tool_calls.length > 0),
                toolCallsCount: aiResponse.tool_calls?.length || 0
            });

            if (!aiResponse.content && (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0)) {
                return {
                    messages: [new AIMessage("I apologize, but I couldn't process that request. Please try again.")]
                };
            }

            return { messages: [response] };
        } catch (error) {
            console.error("[WebAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
        }
    }

    private WebAgentRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }
        return "tools";
    }

    public async run(inputMessages: AgentChatMessage[]): Promise<Response> {
        const history = inputMessages.map((message) => {
            return message.role == AgentUserRole
                ? new HumanMessage(message.content)
                : new AIMessage(message.content);
        });

        const eventStream = this.agentGraph!.streamEvents(
            { messages: history },
            { version: "v2" }
        );

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
                        payload: { name: "WebAgent", content: JSON.stringify(inputMessages), id: "WebAgent" }
                    });

                    for await (const event of eventStream) {
                        if (event.event === AGENT_START_EVENT && event.name === "tools") {
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: { name: "web_tool", content: JSON.stringify(event.data.input), id: event.run_id }
                            });
                        }
                        else if (event.event === AGENT_END_EVENT && event.name === "tools") {
                            let output = event.data.output;
                            if (output?.messages?.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                            }
                            enqueueJson({
                                type: AGENT_ENDED,
                                payload: { name: "web_tool", content: JSON.stringify(output), id: event.run_id }
                            });
                        }
                        else if (event.event === ON_CHAT_MODEL_STREAM_EVENT) {
                            enqueueJson({
                                type: AGENT_STREAM,
                                payload: { name: event.name, content: event.data.chunk, id: event.run_id }
                            });
                        }
                    }
                } catch (error) {
                    console.error("[WebScraperAgent] CRITICAL ERROR:", error);
                    enqueueJson({
                        type: AGENT_ERROR,
                        payload: { name: "WebAgent", content: error instanceof Error ? error.message : "Unknown error", id: "WebAgent" }
                    });
                } finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: { name: "WebAgent", content: "", id: "WebAgent" }
                    });
                    controller.close();
                }
            }
        });

        return new Response(responseStream, {
            headers: { "Content-Type": "application/json", "charset": "utf-8" }
        });
    }
}

export const webAgent = new WebAgent(WebAgentConfig);
