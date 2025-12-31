import { DynamicStructuredTool } from "@langchain/core/tools";
import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR } from "@/lib/constants";
import { AgentChatMessage, LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { MainAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { githubAgent } from "../githubAgent/githubAgent";
import { webScraperAgent } from "../webScraperAgent/webScraperAgent";
import { createDelegationTools } from "./tools";

class MainAgent extends BaseAgent<LLMImplMetadata> {

    /**
     * @param mainAgentConfig Main agent configuration
     */
    constructor(mainAgentConfig: AgentConfig<LLMImplMetadata>) {
        super(mainAgentConfig);

        // Create delegation tools for all sub-agents
        this.agentTools = createDelegationTools();

        // Use factory method to create LLM based on config provider
        const llm = this.createLLMFromConfig();
        this.agentLLM = llm.bindTools!(this.agentTools);

        // Build the orchestrator graph with subgraph nodes
        const mainAgentGraph = new StateGraph(MessagesAnnotation)
            // Orchestrator node - decides what to do
            .addNode("MainAgentNode", this.agentNode.bind(this))
            // Preprocessing nodes - extract task and create HumanMessage
            .addNode("PrepareGitHubTask", this.prepareGitHubTask.bind(this))
            .addNode("PrepareWebScraperTask", this.prepareWebScraperTask.bind(this))
            // Sub-agent subgraphs
            .addNode("GitHubAgentSubgraph", githubAgent.getCompiledGraph())
            .addNode("WebScraperAgentSubgraph", webScraperAgent.getCompiledGraph())
            // Entry point
            .addEdge(START, "MainAgentNode")
            // Conditional routing from orchestrator
            .addConditionalEdges("MainAgentNode", this.orchestratorRoute.bind(this))
            // Preprocessing -> Subgraph edges
            .addEdge("PrepareGitHubTask", "GitHubAgentSubgraph")
            .addEdge("PrepareWebScraperTask", "WebScraperAgentSubgraph")
            // Subgraph -> Orchestrator edges (return after completion)
            .addEdge("GitHubAgentSubgraph", "MainAgentNode")
            .addEdge("WebScraperAgentSubgraph", "MainAgentNode");

        this.agentGraph = mainAgentGraph.compile();
    }

    /**
     * Orchestrator node - decides whether to answer directly or delegate
     * @param state Agent state
     * @returns Updated state with response
     */
    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.implementationMetadata.systemInstruction),
            ...messages
        ];

        try {
            const response = await this.agentLLM!.invoke(messagesToSend);
            return {
                messages: [response]
            };
        } catch (error) {
            console.error("[MainAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                messages: [new AIMessage(`Error: ${errorMessage}`)]
            };
        }
    }

    /**
     * Route based on the orchestrator's decision
     * @param state Agent state
     * @returns Routing decision
     */
    private orchestratorRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        // No tool calls = done
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }

        // Check for GitHub delegation
        if (lastMessage.tool_calls.find(tc => tc.name === "delegate_to_github")) {
            console.log("[MainAgent] Routing to PrepareGitHubTask");
            return "PrepareGitHubTask";
        }

        // Check for Coding delegation
        if (lastMessage.tool_calls.find(tc => tc.name === "delegate_to_coding")) {
            console.log("[MainAgent] Routing to PrepareCodingTask");
            return "PrepareCodingTask";
        }

        // Check for Web Scraper delegation
        if (lastMessage.tool_calls.find(tc => tc.name === "delegate_to_webscraper")) {
            console.log("[MainAgent] Routing to PrepareWebScraperTask");
            return "PrepareWebScraperTask";
        }

        // Default: end
        return END;
    }

    /**
     * Prepare task for GitHub Agent
     */
    private prepareGitHubTask(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        const delegation = lastMessage.tool_calls?.find(tc => tc.name === "delegate_to_github");
        const task = delegation?.args?.task as string || "Help with GitHub";

        console.log("[MainAgent] Preparing task for GitHub Agent:", task);

        return {
            messages: [new HumanMessage(`[GitHub Task] ${task}`)]
        };
    }

    /**
     * Prepare task for Coding Agent
     */
    private prepareCodingTask(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        const delegation = lastMessage.tool_calls?.find(tc => tc.name === "delegate_to_coding");
        const task = delegation?.args?.task as string || "Help with coding";

        console.log("[MainAgent] Preparing task for Coding Agent:", task);

        return {
            messages: [new HumanMessage(`[Coding Task] ${task}`)]
        };
    }

    /**
     * Prepare task for Web Scraper Agent
     */
    private prepareWebScraperTask(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        const delegation = lastMessage.tool_calls?.find(tc => tc.name === "delegate_to_webscraper");
        const task = delegation?.args?.task as string || "Help with web scraping";

        console.log("[MainAgent] Preparing task for Web Scraper Agent:", task);

        return {
            messages: [new HumanMessage(`[Web Scraper Task] ${task}`)]
        };
    }

    /**
     * Get the compiled graph for this agent
     * @returns Compiled LangGraph Runnable
     */
    public getCompiledGraph(): Runnable {
        return this.agentGraph!;
    }

    /**
     * Run the agent with streaming response
     * @param inputMessages Input messages
     * @returns Streaming Response
     */
    public async run(inputMessages: AgentChatMessage[]): Promise<Response> {
        const history = inputMessages.map((message) => {
            return message.role == AgentUserRole ? new HumanMessage(message.content) : new AIMessage(message.content);
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
                        // Subgraph started
                        if (event.event === AGENT_START_EVENT && (event.name === "GitHubAgentSubgraph" || event.name === "WebScraperAgentSubgraph")) {
                            const agentName = event.name === "GitHubAgentSubgraph" ? "GitHubAgent" : "WebScraperAgent";
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: {
                                    name: agentName,
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id
                                }
                            });
                        }
                        // Subgraph ended
                        else if (event.event === AGENT_END_EVENT && (event.name === "GitHubAgentSubgraph" || event.name === "WebScraperAgentSubgraph")) {
                            const agentName = event.name === "GitHubAgentSubgraph" ? "GitHubAgent" : "WebScraperAgent";
                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                            }

                            enqueueJson({
                                type: AGENT_ENDED,
                                payload: {
                                    name: agentName,
                                    content: JSON.stringify(output),
                                    id: event.run_id
                                }
                            });
                        }
                        // Tool execution in subgraphs
                        else if (event.event === AGENT_START_EVENT && event.name === "tools") {
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: {
                                    name: "tool",
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
                                    name: "tool",
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
                    console.error("[MainAgent] CRITICAL ERROR inside stream loop:", error);
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