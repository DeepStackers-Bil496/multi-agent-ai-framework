import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR } from "@/lib/constants";
import { AgentChatMessage, APILLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { CodingAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllCodingTools } from "./tools";

class CodingAgent extends BaseAgent<APILLMImplMetadata> {

    private codingAgentLLM: Runnable | null = null;
    private codingAgentGraph: Runnable | null = null;
    private codingAgentTools: DynamicStructuredTool[] = [];
    private isInitialized = false;

    /**
     * @param codingAgentConfig Coding agent configuration
     */
    constructor(codingAgentConfig: AgentConfig<APILLMImplMetadata>) {
        super(codingAgentConfig);
    }

    /**
     * Lazily initialize the LLM and graph at runtime.
     */
    private ensureInitialized(): void {
        if (this.isInitialized) {
            return;
        }

        // Create all E2B coding tools
        this.codingAgentTools = createAllCodingTools();

        console.log("[CodingAgent] Initializing with Gemini...");

        this.codingAgentLLM = new ChatGoogleGenerativeAI({
            model: this.implementationMetadata.modelID,
            apiKey: this.implementationMetadata.apiKey,
        }).bindTools(this.codingAgentTools);

        // Create tool node for executing tools
        const toolNode = new ToolNode(this.codingAgentTools);

        // Build the agent graph
        const codingAgentGraph = new StateGraph(MessagesAnnotation)
            .addNode("CodingAgentNode", this.agentNode.bind(this))
            .addNode("tools", toolNode)
            .addEdge(START, "CodingAgentNode")
            .addConditionalEdges("CodingAgentNode", this.CodingAgentRoute.bind(this))
            .addEdge("tools", "CodingAgentNode"); // Loop back after tool execution

        this.codingAgentGraph = codingAgentGraph.compile();
        this.isInitialized = true;
        console.log("[CodingAgent] Initialized successfully");
    }

    /**
     * @param state Agent state
     * @returns Agent node implementation
     */
    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.implementationMetadata.systemInstruction),
            ...messages
        ];

        try {
            console.log("[CodingAgent] Invoking LLM with", messages.length, "messages");
            const response = await this.codingAgentLLM!.invoke(messagesToSend);

            const aiResponse = response as AIMessage;
            console.log("[CodingAgent] Response received:", {
                hasContent: !!aiResponse.content,
                contentLength: typeof aiResponse.content === 'string' ? aiResponse.content.length : 0,
                hasToolCalls: !!(aiResponse.tool_calls && aiResponse.tool_calls.length > 0),
                toolCallsCount: aiResponse.tool_calls?.length || 0
            });

            if (!aiResponse.content && (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0)) {
                console.warn("[CodingAgent] Empty response from LLM, returning fallback");
                return {
                    messages: [new AIMessage("I apologize, but I couldn't process that request. Please try again.")]
                };
            }

            return {
                messages: [response]
            };
        } catch (error) {
            console.error("[CodingAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                messages: [new AIMessage(`Error: ${errorMessage}`)]
            };
        }
    }

    /**
     * Route the agent to the correct tool or end.
     * @param state Agent state
     * @returns Agent route
     */
    private CodingAgentRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }

        return "tools";
    }

    /**
     * Get the compiled graph for this agent.
     * Used for embedding this agent as a subgraph node in a parent graph.
     * @returns Compiled LangGraph Runnable
     */
    public getCompiledGraph(): Runnable {
        this.ensureInitialized();
        return this.codingAgentGraph!;
    }

    /**
     * @param inputMessages Input messages
     * @returns Response
     */
    public async run(inputMessages: AgentChatMessage[]): Promise<Response> {
        try {
            this.ensureInitialized();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Initialization failed";
            console.error("[CodingAgent] Initialization error:", errorMessage);

            const encoder = new TextEncoder();
            const errorResponse = JSON.stringify({
                type: AGENT_ERROR,
                payload: { name: "CodingAgent", content: errorMessage, id: "CodingAgent" }
            }) + "\n";

            return new Response(encoder.encode(errorResponse), {
                headers: { "Content-Type": "application/json" }
            });
        }

        const history = inputMessages.map((message) => {
            return message.role == AgentUserRole
                ? new HumanMessage(message.content)
                : new AIMessage(message.content);
        });

        const eventStream = this.codingAgentGraph!.streamEvents(
            { messages: history },
            { version: "v2" }
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
                            name: "CodingAgent",
                            content: JSON.stringify(inputMessages),
                            id: "CodingAgent"
                        }
                    });

                    for await (const event of eventStream) {
                        if (event.event === AGENT_START_EVENT && event.name === "tools") {
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: {
                                    name: "coding_tool",
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id
                                }
                            });
                        }
                        else if (event.event === AGENT_END_EVENT && event.name === "tools") {
                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                            }

                            enqueueJson({
                                type: AGENT_ENDED,
                                payload: {
                                    name: "coding_tool",
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
                    console.error("[CodingAgent] CRITICAL ERROR inside stream loop:", error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred inside the stream.";
                    enqueueJson({
                        type: AGENT_ERROR,
                        payload: {
                            name: "CodingAgent",
                            content: errorMessage,
                            id: "CodingAgent"
                        }
                    });
                }
                finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: {
                            name: "CodingAgent",
                            content: "",
                            id: "CodingAgent"
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

export const codingAgent = new CodingAgent(CodingAgentConfig);
