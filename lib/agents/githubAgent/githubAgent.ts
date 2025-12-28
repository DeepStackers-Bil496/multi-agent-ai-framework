import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR } from "@/lib/constants";
import { AgentChatMessage, APILLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { GitHubAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createGitHubMCPTool } from "./tools";

class GitHubAgent extends BaseAgent<APILLMImplMetadata> {

    private githubAgentLLM: Runnable | null = null;
    private githubAgentGraph: Runnable | null = null;
    private githubAgentTools: DynamicStructuredTool[] = [];
    private isInitialized = false;

    /**
     * @param githubAgentConfig GitHub agent configuration
     */
    constructor(githubAgentConfig: AgentConfig<APILLMImplMetadata>) {
        super(githubAgentConfig);
    }

    /**
     * Lazily initialize the LLM and graph at runtime.
     * Uses Ollama for local development, Groq for production.
     */
    private ensureInitialized(): void {
        if (this.isInitialized) {
            return;
        }

        // Create GitHub MCP tool
        this.githubAgentTools = [createGitHubMCPTool()];

        // Check if we should use Ollama (local development)
        const useOllama = process.env.USE_OLLAMA === "true";
        const isDev = process.env.NODE_ENV === "development";

        if (useOllama && isDev) {
            // Use Ollama for local development - FREE and no rate limits!
            console.log("[GitHubAgent] Initializing with Ollama (local)...");

            const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";
            const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

            this.githubAgentLLM = new ChatOllama({
                model: ollamaModel,
                baseUrl: ollamaBaseUrl,
                temperature: 0.1,
            }).bindTools(this.githubAgentTools);

            console.log(`[GitHubAgent] Using Ollama model: ${ollamaModel} at ${ollamaBaseUrl}`);
        } else {
            // Use Groq for production or when Ollama is not enabled
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) {
                throw new Error("GROQ_API_KEY environment variable is not set. Please add it to your .env.local file.");
            }

            console.log("[GitHubAgent] Initializing with Groq (cloud)...");

            this.githubAgentLLM = new ChatGroq({
                model: this.implementationMetadata.modelID,
                apiKey: apiKey,
                temperature: 0.1,
            }).bindTools(this.githubAgentTools);
        }

        // Create tool node for executing tools
        const toolNode = new ToolNode(this.githubAgentTools);

        // Build the agent graph (same pattern as MainAgent)
        const githubAgentGraph = new StateGraph(MessagesAnnotation)
            .addNode("GitHubAgentNode", this.agentNode.bind(this))
            .addNode("tools", toolNode)
            .addEdge(START, "GitHubAgentNode")
            .addConditionalEdges("GitHubAgentNode", this.GitHubAgentRoute.bind(this))
            .addEdge("tools", "GitHubAgentNode"); // Loop back after tool execution

        this.githubAgentGraph = githubAgentGraph.compile();
        this.isInitialized = true;
        console.log("[GitHubAgent] Initialized successfully");
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
        ]

        try {
            console.log("[GitHubAgent] Invoking LLM with", messages.length, "messages");
            const response = await this.githubAgentLLM!.invoke(messagesToSend);

            // Debug: log what we got back
            const aiResponse = response as AIMessage;
            console.log("[GitHubAgent] Response received:", {
                hasContent: !!aiResponse.content,
                contentLength: typeof aiResponse.content === 'string' ? aiResponse.content.length : 0,
                hasToolCalls: !!(aiResponse.tool_calls && aiResponse.tool_calls.length > 0),
                toolCallsCount: aiResponse.tool_calls?.length || 0
            });

            // If response is empty, return a fallback message
            if (!aiResponse.content && (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0)) {
                console.warn("[GitHubAgent] Empty response from LLM, returning fallback");
                return {
                    messages: [new AIMessage("I apologize, but I couldn't process that request. Please try again or rephrase your question.")]
                }
            }

            return {
                messages: [response]
            }
        } catch (error) {
            console.error("[GitHubAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                messages: [new AIMessage(`Error: ${errorMessage}`)]
            }
        }
    }

    /**
     * This method is used to route the agent to the correct tool or end.
     * @param state Agent state
     * @returns Agent route
     */
    private GitHubAgentRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        // If no tool calls, we're done
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }

        // Route to tools node
        return "tools";
    }

    /**
     * @param inputMessages Input messages
     * @returns Response
     */
    public async run(inputMessages: AgentChatMessage[]): Promise<Response> {
        // Initialize lazily at runtime
        try {
            this.ensureInitialized();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Initialization failed";
            console.error("[GitHubAgent] Initialization error:", errorMessage);

            const encoder = new TextEncoder();
            const errorResponse = JSON.stringify({
                type: AGENT_ERROR,
                payload: { name: "GitHubAgent", content: errorMessage, id: "GitHubAgent" }
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

        const eventStream = this.githubAgentGraph!.streamEvents(
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
                            name: "GitHubAgent",
                            content: JSON.stringify(inputMessages),
                            id: "GitHubAgent"
                        }
                    });

                    for await (const event of eventStream) {
                        // Tool execution started
                        if (event.event === AGENT_START_EVENT && event.name === "tools") {
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: {
                                    name: "github_mcp_tool",
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id
                                }
                            });
                        }
                        // Tool execution ended
                        else if (event.event === AGENT_END_EVENT && event.name === "tools") {
                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                            }

                            enqueueJson({
                                type: AGENT_ENDED,
                                payload: {
                                    name: "github_mcp_tool",
                                    content: JSON.stringify(output),
                                    id: event.run_id
                                }
                            });
                        }
                        // LLM streaming
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
                    console.error("[GitHubAgent] CRITICAL ERROR inside stream loop:", error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred inside the stream.";
                    enqueueJson({
                        type: AGENT_ERROR,
                        payload: {
                            name: "GitHubAgent",
                            content: errorMessage,
                            id: "GitHubAgent"
                        }
                    });
                }
                finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: {
                            name: "GitHubAgent",
                            content: "",
                            id: "GitHubAgent"
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

export const githubAgent = new GitHubAgent(GitHubAgentConfig);
