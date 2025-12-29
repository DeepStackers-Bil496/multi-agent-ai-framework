import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR } from "@/lib/constants";
import { AgentChatMessage, APILLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { WebScraperAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllWebScraperTools } from "./tools";

class WebScraperAgent extends BaseAgent<APILLMImplMetadata> {

    private webScraperAgentLLM: Runnable | null = null;
    private webScraperAgentGraph: Runnable | null = null;
    private webScraperAgentTools: DynamicStructuredTool[] = [];
    private isInitialized = false;

    constructor(webScraperAgentConfig: AgentConfig<APILLMImplMetadata>) {
        super(webScraperAgentConfig);
    }

    private ensureInitialized(): void {
        if (this.isInitialized) {
            return;
        }

        this.webScraperAgentTools = createAllWebScraperTools();

        console.log("[WebScraperAgent] Initializing with Gemini...");

        this.webScraperAgentLLM = new ChatGoogleGenerativeAI({
            model: this.implementationMetadata.modelID,
            apiKey: this.implementationMetadata.apiKey,
        }).bindTools(this.webScraperAgentTools);

        const toolNode = new ToolNode(this.webScraperAgentTools);

        const webScraperAgentGraph = new StateGraph(MessagesAnnotation)
            .addNode("WebScraperAgentNode", this.agentNode.bind(this))
            .addNode("tools", toolNode)
            .addEdge(START, "WebScraperAgentNode")
            .addConditionalEdges("WebScraperAgentNode", this.WebScraperAgentRoute.bind(this))
            .addEdge("tools", "WebScraperAgentNode");

        this.webScraperAgentGraph = webScraperAgentGraph.compile();
        this.isInitialized = true;
        console.log("[WebScraperAgent] Initialized successfully");
    }

    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.implementationMetadata.systemInstruction),
            ...messages
        ];

        try {
            console.log("[WebScraperAgent] Invoking LLM with", messages.length, "messages");
            const response = await this.webScraperAgentLLM!.invoke(messagesToSend);

            const aiResponse = response as AIMessage;
            console.log("[WebScraperAgent] Response received:", {
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
            console.error("[WebScraperAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
        }
    }

    private WebScraperAgentRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }
        return "tools";
    }

    public getCompiledGraph(): Runnable {
        this.ensureInitialized();
        return this.webScraperAgentGraph!;
    }

    public async run(inputMessages: AgentChatMessage[]): Promise<Response> {
        try {
            this.ensureInitialized();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Initialization failed";
            console.error("[WebScraperAgent] Initialization error:", errorMessage);

            const encoder = new TextEncoder();
            const errorResponse = JSON.stringify({
                type: AGENT_ERROR,
                payload: { name: "WebScraperAgent", content: errorMessage, id: "WebScraperAgent" }
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

        const eventStream = this.webScraperAgentGraph!.streamEvents(
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
                        payload: { name: "WebScraperAgent", content: JSON.stringify(inputMessages), id: "WebScraperAgent" }
                    });

                    for await (const event of eventStream) {
                        if (event.event === AGENT_START_EVENT && event.name === "tools") {
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: { name: "webscraper_tool", content: JSON.stringify(event.data.input), id: event.run_id }
                            });
                        }
                        else if (event.event === AGENT_END_EVENT && event.name === "tools") {
                            let output = event.data.output;
                            if (output?.messages?.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                            }
                            enqueueJson({
                                type: AGENT_ENDED,
                                payload: { name: "webscraper_tool", content: JSON.stringify(output), id: event.run_id }
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
                        payload: { name: "WebScraperAgent", content: error instanceof Error ? error.message : "Unknown error", id: "WebScraperAgent" }
                    });
                } finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: { name: "WebScraperAgent", content: "", id: "WebScraperAgent" }
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

export const webScraperAgent = new WebScraperAgent(WebScraperAgentConfig);
