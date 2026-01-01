import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR, TOOL_STARTED_EVENT, TOOL_ENDED_EVENT, TOOL_ENDED, TOOL_STARTED } from "@/lib/constants";
import { AgentChatMessage, LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { MainAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { githubAgent } from "../githubAgent/githubAgent";
import { webAgent } from "../webAgent/webAgent";
import { emailAgent } from "../emailAgent/emailAgent";
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
        console.log(`[MainAgent] Initializing with provider: ${this.implementationMetadata.provider}`);
        const llm = this.createLLMFromConfig();
        this.agentLLM = llm.bindTools!(this.agentTools);

        // Build the orchestrator graph with subgraph nodes
        const mainAgentGraph = new StateGraph(MessagesAnnotation)
            // Orchestrator node - decides what to do
            .addNode("MainAgentNode", this.agentNode.bind(this))
            // Preprocessing nodes - extract task and create HumanMessage
            .addNode("PrepareGitHubAgentTask", this.PrepareGitHubAgentTask.bind(this))
            .addNode("PrepareEmailAgentTask", this.PrepareEmailAgentTask.bind(this))
            .addNode("PrepareWebAgentTask", this.PrepareWebAgentTask.bind(this))
            // Sub-agent subgraphs
            .addNode("GitHubAgentSubgraph", githubAgent.getCompiledGraph())
            .addNode("EmailAgentSubgraph", emailAgent.getCompiledGraph())
            .addNode("WebAgentSubgraph", webAgent.getCompiledGraph())
            // Entry point
            .addEdge(START, "MainAgentNode")
            // Conditional routing from orchestrator
            .addConditionalEdges("MainAgentNode", this.orchestratorRoute.bind(this))
            // Preprocessing -> Subgraph edges
            .addEdge("PrepareGitHubAgentTask", "GitHubAgentSubgraph")
            .addEdge("PrepareEmailAgentTask", "EmailAgentSubgraph")
            .addEdge("PrepareWebAgentTask", "WebAgentSubgraph")
            // Subgraph -> Orchestrator edges (return after completion)
            .addEdge("GitHubAgentSubgraph", "MainAgentNode")
            .addEdge("EmailAgentSubgraph", "MainAgentNode")
            .addEdge("WebAgentSubgraph", "MainAgentNode");

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
            console.log("[MainAgent] Routing to PrepareGitHubAgentTask");
            return "PrepareGitHubAgentTask";
        }
        // Check for Email delegation
        if (lastMessage.tool_calls.find(tc => tc.name === "delegate_to_email")) {
            console.log("[MainAgent] Routing to PrepareEmailAgentTask");
            return "PrepareEmailAgentTask";
        }
        // Check for Web Scraper delegation
        if (lastMessage.tool_calls.find(tc => tc.name === "delegate_to_webscraper")) {
            console.log("[MainAgent] Routing to PrepareWebAgentTask");
            return "PrepareWebAgentTask";
        }

        // Default: end
        return END;
    }

    /**
     * Prepare task for GitHub Agent
     */
    private PrepareGitHubAgentTask(state: typeof MessagesAnnotation.State) {
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
     * Prepare task for Web Agent
     */
    private PrepareWebAgentTask(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        const delegation = lastMessage.tool_calls?.find(tc => tc.name === "delegate_to_webscraper");
        const task = delegation?.args?.task as string || "Help with web scraping";

        console.log("[MainAgent] Preparing task for Web Agent:", task);

        return {
            messages: [new HumanMessage(`[Web Task] ${task}`)]
        };
    }

    /**
     * Prepare task for Email Agent
     */
    private PrepareEmailAgentTask(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        const delegation = lastMessage.tool_calls?.find(tc => tc.name === "delegate_to_email");
        const task = delegation?.args?.task as string || "Help with email drafting";

        console.log("[MainAgent] Preparing task for Email Agent:", task);

        return {
            messages: [new HumanMessage(`[Email Task] ${task}`)]
        };
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

        const agentName = this.name;
        const agentId = this.id;

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
                            name: agentName,
                            content: JSON.stringify(inputMessages),
                            id: agentId
                        }
                    });

                    for await (const event of eventStream) {
                        // Subgraph started
                        if (event.event === AGENT_START_EVENT && (event.name === "GitHubAgentSubgraph" || event.name === "WebAgentSubgraph" || event.name === "EmailAgentSubgraph")) {
                            const agentName = event.name === "GitHubAgentSubgraph" ? githubAgent.name : event.name === "EmailAgentSubgraph" ? emailAgent.name : webAgent.name;
                            const agentId = event.name === "GitHubAgentSubgraph" ? githubAgent.id : event.name === "EmailAgentSubgraph" ? emailAgent.id : webAgent.id;
                            enqueueJson({
                                type: AGENT_STARTED,
                                payload: {
                                    name: agentName,
                                    content: JSON.stringify(event.data.input),
                                    id: agentId
                                }
                            });
                            console.log("[MainAgent] Subgraph started:", agentName);
                        }
                        // Subgraph ended
                        else if (event.event === AGENT_END_EVENT && (event.name === "GitHubAgentSubgraph" || event.name === "WebAgentSubgraph" || event.name === "EmailAgentSubgraph")) {
                            const agentName = event.name === "GitHubAgentSubgraph" ? githubAgent.name : event.name === "EmailAgentSubgraph" ? emailAgent.name : webAgent.name;
                            const agentId = event.name === "GitHubAgentSubgraph" ? githubAgent.id : event.name === "EmailAgentSubgraph" ? emailAgent.id : webAgent.id;
                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
                                output = output.messages[output.messages.length - 1].content;
                            }

                            enqueueJson({
                                type: AGENT_ENDED,
                                payload: {
                                    name: agentName,
                                    content: JSON.stringify(output),
                                    id: agentId
                                }
                            });
                            console.log("[MainAgent] Subgraph ended:", agentName);
                        }
                        // Tool execution
                        else if (event.event === TOOL_STARTED_EVENT && event.name === "tools") {
                            // Extract actual tool name from input messages
                            let toolName = "tool";
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
                                    id: event.run_id
                                }
                            });
                            console.log("[MainAgent] Tool started:", toolName);
                        }
                        else if (event.event === TOOL_ENDED_EVENT && event.name === "tools") {
                            // Extract tool name from output
                            let toolName = "tool";
                            let output = event.data.output;
                            if (output && output.messages && output.messages.length > 0) {
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
                            name: agentName,
                            content: errorMessage,
                            id: agentId
                        }
                    });
                }
                finally {
                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: {
                            name: agentName,
                            content: "",
                            id: agentId
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
