import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { Runnable } from "@langchain/core/runnables";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, ON_CHAT_MODEL_END_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR, TOOL_STARTED_EVENT, TOOL_ENDED_EVENT, TOOL_ENDED, TOOL_STARTED, USAGE_UPDATE } from "@/lib/constants";
import { AgentChatMessage, LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { MainAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { agentRegistry, DelegatableAgent } from "../agentRegistry";
import { createDelegationToolsFromRegistry } from "./delegationToolFactory";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createLLM } from "../llmFactory";

// Import agents to trigger self-registration
import "../githubAgent/githubAgent";
import "../codebaseAgent/codebaseAgent";
import "../frontendAgent/frontendAgent";
import "../huggingFaceAgent/huggingFaceAgent";
import "../googleWorkspaceAgent/googleWorkspaceAgent";
import "../searchAgent/searchAgent";
import "../codingAgent/codingAgent";
import "../dataAnalystAgent/dataAnalystAgent";
import "../visionAgent/visionAgent";

class MainAgent extends BaseAgent<LLMImplMetadata> {

    constructor(mainAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(mainAgentConfig, agentTools);

        console.log(`[MainAgent] Initializing with provider: ${this.implementationMetadata.provider}`);
        const llm = this.createLLMFromConfig();
        this.agentLLM = llm.bindTools!(this.agentTools);

        // Build the orchestrator graph dynamically from registry
        this.agentGraph = this.buildOrchestratorGraph();
    }

    /**
     * Create delegation tools - MainAgent doesn't need runtime secrets itself
     * (child agents handle their own secrets via their createTools implementations)
     */
    protected createTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
        return createDelegationToolsFromRegistry();
    }

    /**
     * Build the orchestrator graph dynamically from registered agents
     */
    private buildOrchestratorGraph() {
        const registeredAgents = agentRegistry.getAll();
        console.log(`[MainAgent] Building graph with ${registeredAgents.length} registered agents`);

        // Use 'any' for graph variable since node names are dynamic (from registry)
        // LangGraph's strict typing requires known node names at compile time
        let graph: any = new StateGraph(MessagesAnnotation)
            .addNode("MainAgentNode", this.agentNode.bind(this))
            .addEdge(START, "MainAgentNode")
            .addConditionalEdges("MainAgentNode", this.orchestratorRoute.bind(this));

        // Dynamically add nodes for each registered agent
        for (const agent of registeredAgents) {
            const prepareNodeName = `Prepare_${agent.id}_Task`;
            const subgraphNodeName = `${agent.id}_Subgraph`;

            graph = graph
                .addNode(prepareNodeName, this.createPrepareTaskNode(agent))
                .addNode(subgraphNodeName, agent.getCompiledGraph())
                .addEdge(prepareNodeName, subgraphNodeName)
                .addEdge(subgraphNodeName, "MainAgentNode");
        }

        return graph.compile();
    }

    /**
     * Helper to capitalize agent ID for node names
     */
    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Create a prepare task node for a delegatable agent
     */
    private createPrepareTaskNode(agent: DelegatableAgent) {
        return (state: typeof MessagesAnnotation.State) => {
            const { messages } = state;
            const lastMessage = messages[messages.length - 1] as AIMessage;
            const delegation = lastMessage.tool_calls?.find(tc => tc.name === agent.toolName);
            const task = delegation?.args?.task as string || `Help with ${agent.name}`;
            console.log(`[MainAgent] Preparing task for ${agent.name}:`, task);
            return {
                messages: [new HumanMessage(`${agent.taskPrefix} ${task}`)]
            };
        };
    }

    /**
     * Orchestrator node - decides whether to answer directly or delegate
     */
    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const messagesToSend = [
            new SystemMessage(this.implementationMetadata.systemInstruction),
            ...messages
        ];

        try {
            const response = await this.agentLLM!.invoke(messagesToSend);
            return { messages: [response] };
        } catch (error) {
            console.error("[MainAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
        }
    }

    /**
     * Route based on the orchestrator's decision
     */
    private orchestratorRoute(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;

        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return END;
        }

        // Find the matching agent from registry
        for (const toolCall of lastMessage.tool_calls) {
            const agent = agentRegistry.getByToolName(toolCall.name);
            if (agent) {
                const prepareNodeName = `Prepare_${agent.id}_Task`;
                console.log(`[MainAgent] Routing to ${prepareNodeName}`);
                return prepareNodeName;
            }
        }

        return END;
    }

    /**
     * Gets or creates orchestrator graph with caching based on config version.
     */
    private getOrCreateOrchestratorGraph(runtimeConfig?: Partial<LLMImplMetadata>): Runnable {
        const newConfigVersion = runtimeConfig?._configVersion;

        if (runtimeConfig && Object.keys(runtimeConfig).length > 0) {
            if (newConfigVersion !== this.lastConfigVersion) {
                console.log(`[MainAgent] Config changed (${this.lastConfigVersion} -> ${newConfigVersion}), recreating orchestrator graph`);
                this.agentGraph = this.createRuntimeOrchestratorGraph(runtimeConfig);
                this.lastConfigVersion = newConfigVersion ?? null;
            } else {
                console.log(`[MainAgent] Config unchanged (${newConfigVersion}), reusing cached orchestrator graph`);
            }
        }

        return this.agentGraph!;
    }

    /**
     * Create a runtime orchestrator graph with user-configured LLM
     * This allows MainAgent to use the user's preferred provider/model
     */
    private createRuntimeOrchestratorGraph(runtimeConfig: Partial<LLMImplMetadata>) {
        // Merge runtime config with default implementation metadata
        const mergedConfig: LLMImplMetadata = {
            ...this.implementationMetadata as LLMImplMetadata,
            ...runtimeConfig,
            // Always preserve the system instruction from agent defaults
            systemInstruction: (this.implementationMetadata as LLMImplMetadata).systemInstruction,
        };

        console.log(`[MainAgent] Creating runtime LLM with provider: ${mergedConfig.provider}, model: ${mergedConfig.modelID}`);

        // Create new LLM with merged config and bind tools
        const runtimeLLM = createLLM(mergedConfig);
        const boundLLM = runtimeLLM.bindTools!(this.agentTools);

        // Create a runtime agent node that uses the new LLM
        const runtimeAgentNode = async (state: typeof MessagesAnnotation.State) => {
            const { messages } = state;
            const messagesToSend = [
                new SystemMessage(mergedConfig.systemInstruction),
                ...messages
            ];

            try {
                const response = await boundLLM.invoke(messagesToSend);
                return { messages: [response] };
            } catch (error) {
                console.error("[MainAgent] (Runtime) Error in agentNode:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
            }
        };

        // Build the graph with the runtime LLM
        const registeredAgents = agentRegistry.getAll();
        let graph: any = new StateGraph(MessagesAnnotation)
            .addNode("MainAgentNode", runtimeAgentNode)
            .addEdge(START, "MainAgentNode")
            .addConditionalEdges("MainAgentNode", this.orchestratorRoute.bind(this));

        // Dynamically add nodes for each registered agent
        for (const agent of registeredAgents) {
            const prepareNodeName = `Prepare_${agent.id}_Task`;
            const subgraphNodeName = `${agent.id}_Subgraph`;

            // Get runtime config for this specific sub-agent, if available
            const subAgentConfig = runtimeConfig?.subAgentConfigs?.[agent.id];

            graph = graph
                .addNode(prepareNodeName, this.createPrepareTaskNode(agent))
                // Use cached runtime graph for sub-agents (only recreates if config changed)
                .addNode(subgraphNodeName, agent.instance.getOrCreateRuntimeGraph(subAgentConfig, this.runtimeSecrets))
                .addEdge(prepareNodeName, subgraphNodeName)
                .addEdge(subgraphNodeName, "MainAgentNode");
        }

        return graph.compile();
    }

    /**
     * Run the agent with streaming response
     */
    public async run(inputMessages: AgentChatMessage[], runtimeConfig?: Partial<LLMImplMetadata>, runtimeSecrets?: Record<string, string>): Promise<Response> {
        // Store runtime secrets for child agents to access
        this.runtimeSecrets = runtimeSecrets;

        const history = inputMessages.map((message) => {
            return message.role == AgentUserRole ? new HumanMessage(message.content) : new AIMessage(message.content);
        });

        // Get or create orchestrator graph (uses caching based on config version)
        const graphToUse = this.getOrCreateOrchestratorGraph(runtimeConfig);

        const eventStream = graphToUse.streamEvents(
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

                // Track accumulated token usage across all LLM calls
                let totalPromptTokens = 0;
                let totalCompletionTokens = 0;

                try {
                    enqueueJson({
                        type: AGENT_STARTED,
                        payload: { name: agentName, content: JSON.stringify(inputMessages), id: agentId }
                    });

                    for await (const event of eventStream) {
                        // Check for subgraph events using registry
                        const subgraphMatch = event.name?.match(/^(.+)_Subgraph$/);
                        if (subgraphMatch) {
                            const agentIdFromEvent = subgraphMatch[1];
                            const registeredAgent = agentRegistry.getById(agentIdFromEvent);

                            if (registeredAgent) {
                                if (event.event === AGENT_START_EVENT) {
                                    enqueueJson({
                                        type: AGENT_STARTED,
                                        payload: { name: registeredAgent.name, content: JSON.stringify(event.data.input), id: registeredAgent.id }
                                    });
                                    console.log("[MainAgent] Subgraph started:", registeredAgent.name);
                                } else if (event.event === AGENT_END_EVENT) {
                                    let output = event.data.output;
                                    if (output?.messages?.length > 0) {
                                        output = output.messages[output.messages.length - 1].content;
                                    }
                                    enqueueJson({
                                        type: AGENT_ENDED,
                                        payload: { name: registeredAgent.name, content: JSON.stringify(output), id: registeredAgent.id }
                                    });
                                    console.log("[MainAgent] Subgraph ended:", registeredAgent.name);
                                }
                                continue;
                            }
                        }

                        // Tool execution
                        if (event.event === TOOL_STARTED_EVENT && event.name === "tools") {
                            let toolName = "tool";
                            const inputMsgs = event.data.input?.messages;
                            if (inputMsgs?.length > 0) {
                                const lastMsg = inputMsgs[inputMsgs.length - 1];
                                if (lastMsg.tool_calls?.length > 0) {
                                    toolName = lastMsg.tool_calls[0].name;
                                }
                            }
                            enqueueJson({
                                type: TOOL_STARTED,
                                payload: { name: toolName, content: JSON.stringify(event.data.input), id: event.run_id }
                            });
                            console.log("[MainAgent] Tool started:", toolName);
                        }
                        else if (event.event === TOOL_ENDED_EVENT && event.name === "tools") {
                            let toolName = "tool";
                            let output = event.data.output;
                            if (output?.messages?.length > 0) {
                                const toolMsg = output.messages[output.messages.length - 1];
                                if (toolMsg.name) toolName = toolMsg.name;
                                output = toolMsg.content;
                            }
                            enqueueJson({
                                type: TOOL_ENDED,
                                payload: { name: toolName, content: JSON.stringify(output), id: event.run_id }
                            });
                        }
                        // LLM streaming
                        else if (event.event === ON_CHAT_MODEL_STREAM_EVENT) {
                            enqueueJson({
                                type: AGENT_STREAM,
                                payload: { name: event.name, content: event.data.chunk, id: event.run_id }
                            });
                        }
                        // LLM call ended - capture token usage
                        else if (event.event === ON_CHAT_MODEL_END_EVENT) {
                            const usageMeta = event.data?.output?.usage_metadata;
                            if (usageMeta) {
                                totalPromptTokens += usageMeta.input_tokens || 0;
                                totalCompletionTokens += usageMeta.output_tokens || 0;
                            }
                        }
                    }
                }
                catch (error) {
                    console.error("[MainAgent] CRITICAL ERROR inside stream loop:", error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred inside the stream.";
                    enqueueJson({
                        type: AGENT_ERROR,
                        payload: { name: agentName, content: errorMessage, id: agentId }
                    });
                }
                finally {
                    // Emit usage update before closing
                    enqueueJson({
                        type: USAGE_UPDATE,
                        payload: {
                            name: agentName,
                            content: JSON.stringify({
                                promptTokens: totalPromptTokens,
                                completionTokens: totalCompletionTokens,
                                totalTokens: totalPromptTokens + totalCompletionTokens,
                            }),
                            id: agentId,
                        },
                    });

                    enqueueJson({
                        type: AGENT_ENDED,
                        payload: { name: agentName, content: "", id: agentId }
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

export const mainAgent = new MainAgent(MainAgentConfig, createDelegationToolsFromRegistry());
