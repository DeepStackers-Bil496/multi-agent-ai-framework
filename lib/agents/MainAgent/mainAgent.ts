import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { MainAgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR } from "@/lib/constants";
import { MainAgentChatMessage, APILLMImpl } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { MainAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";

class MainAgent extends BaseAgent<APILLMImpl> {

    private readonly mainAgentLLM: Runnable;
    private readonly mainAgentGraph: Runnable;
    private readonly mainAgentTools: DynamicStructuredTool[];

    /**
     * @param mainAgentConfig Main agent configuration
     */
    constructor(mainAgentConfig: AgentConfig<APILLMImpl>) {
        super(mainAgentConfig);
        this.mainAgentTools = [];
        this.mainAgentLLM = new ChatGoogleGenerativeAI({
            model: this.implementation.modelID,
            apiKey: this.implementation.apiKey,
        }).bindTools(this.mainAgentTools);

        const mainAgentGraph = new StateGraph(MessagesAnnotation)
            .addNode("MainAgentNode", this.agentNode.bind(this))
            .addEdge(START, "MainAgentNode")
            .addConditionalEdges("MainAgentNode", this.MainAgentRoute);
        this.mainAgentGraph = mainAgentGraph.compile();
    }

    /**
     * @param state Agent state
     * @returns Agent node implementation
     */
    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.implementation.systemInstruction),
            ...messages
        ]

        const response = await this.mainAgentLLM.invoke(messagesToSend);
        return {
            messages: [response]
        }
    }

    /**
     * This method is used to route the agent to the correct tool.
     * @param state Agent state
     * @returns Agent route
     */
    private MainAgentRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }
        const toolName = lastMessage.tool_calls[0].name;
        return toolName;
    }

    /**
     * @param inputMessages Input messages
     * @returns Response
     */
    public async run(inputMessages: MainAgentChatMessage[]): Promise<Response> {
        const history = inputMessages.map((message) => {
            return message.role == MainAgentUserRole ? new HumanMessage(message.content) : new AIMessage(message.content);
        }
        );

        const eventStream = this.mainAgentGraph.streamEvents(
            { messages: history },
            { version: "v2" } // Arkadaşlar kendi websitemde v2 versioyonunu kullandım ama değiştirsekte sorun olacağını sanmıyorum.
        );


        const encoder = new TextEncoder();
        const responseStream = new ReadableStream({
            async start(controller) {
                const enqueueJson = (data: object) => {
                    const json = JSON.stringify(data) + "\n";
                    const chunk = encoder.encode(json);
                    controller.enqueue(chunk);
                };

                try {
                    enqueueJson({
                        type: AGENT_STARTED,
                        payload: {
                            name: "MainAgent",
                            content: JSON.stringify(inputMessages),
                            id: "MainAgent"
                        }
                    });
                    for await (const event of eventStream) {
                        if (event.event === AGENT_START_EVENT && event.name && event.name.endsWith("_worker")) {
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: {
                                    name: event.name,
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id
                                }
                            });
                        }
                        else if (event.event === AGENT_END_EVENT && event.name && event.name.endsWith("_worker")) {

                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                            }

                            enqueueJson({
                                type: AGENT_ENDED,
                                payload: {
                                    name: event.name,
                                    content: JSON.stringify(output),
                                    id: event.run_id
                                }
                            });
                        }
                        else if (event.event === ON_CHAT_MODEL_STREAM_EVENT) {
                            enqueueJson({
                                type: AGENT_STREAM,
                                payload: {
                                    name: event.name,
                                    content: event.data.chunk,
                                    id: event.run_id
                                }
                            });
                        }
                    }
                }
                catch (error) {
                    console.error("[AGENT API] CRITICAL ERROR inside stream loop:", error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred inside the stream.";
                    enqueueJson({
                        type: AGENT_ERROR,
                        payload: {
                            name: "MainAgent",
                            content: errorMessage,
                            id: "MainAgent"
                        }
                    });
                }
                finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: {
                            name: "MainAgent",
                            content: "",
                            id: "MainAgent"
                        }
                    });
                    controller.close();
                }
            }
        });

        return new Response(responseStream, {
            headers: {
                "Content-Type": "application/json",
                "charset": "utf-8"
            }
        });

    }

}

export const mainAgent = new MainAgent(MainAgentConfig);