import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { Runnable } from "@langchain/core/runnables";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { AgentUserRole, AGENT_START_EVENT, AGENT_END_EVENT, ON_CHAT_MODEL_STREAM_EVENT, AGENT_STARTED, AGENT_ENDED, AGENT_STREAM, AGENT_ERROR, TOOL_STARTED_EVENT, TOOL_ENDED_EVENT, TOOL_ENDED, TOOL_STARTED } from "@/lib/constants";
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
     * Build a single self-contained HumanMessage for the sub-agent that includes
     * the original user request and a synthesized record of prior delegation
     * outputs, so the sub-agent has full context regardless of the noisy
     * accumulated MessagesAnnotation state.
     */
    private createPrepareTaskNode(agent: DelegatableAgent) {
        return (state: typeof MessagesAnnotation.State) => {
            const { messages } = state;
            const lastMessage = messages[messages.length - 1] as AIMessage;
            const delegation = lastMessage.tool_calls?.find(tc => tc.name === agent.toolName);
            const task = (delegation?.args?.task as string) || `Help with ${agent.name}`;

            const firstUser = messages.find((m) => m instanceof HumanMessage);
            const originalGoal = firstUser ? String(firstUser.content).trim() : "";

            const priorResults: string[] = [];
            for (let i = 0; i < messages.length - 1; i++) {
                const m = messages[i];
                if (
                    m instanceof AIMessage &&
                    (!m.tool_calls || m.tool_calls.length === 0) &&
                    typeof m.content === "string" &&
                    m.content.trim().length > 0
                ) {
                    priorResults.push(m.content.trim().slice(0, 4000));
                }
            }

            const goalBlock = originalGoal
                ? `\n\nORIGINAL USER REQUEST:\n${originalGoal}`
                : "";
            const priorBlock = priorResults.length
                ? `\n\nPRIOR AGENT OUTPUTS (most recent last):\n${priorResults
                      .map((c, i) => `[${i + 1}] ${c}`)
                      .join("\n\n")}`
                : "";

            const body = `${agent.taskPrefix} ${task}${goalBlock}${priorBlock}`;
            console.log(`[MainAgent] Preparing task for ${agent.name}:`, task);

            // CRITICAL: answer the orchestrator's delegation tool call with a ToolMessage
            // so the conversation stays well-formed. Without it the function call is left
            // dangling, the NEXT orchestrator turn errors, and the loop stops after one
            // agent (never advancing to the next agent).
            const outMessages: (ToolMessage | HumanMessage)[] = [];
            for (const tc of (lastMessage.tool_calls ?? [])) {
                outMessages.push(new ToolMessage({
                    tool_call_id: tc.id ?? tc.name,
                    name: tc.name,
                    content: tc.name === agent.toolName
                        ? `Delegated to ${agent.name}; running now. Its result will follow.`
                        : `Not run this turn; will be handled in a later step.`,
                }));
            }
            outMessages.push(new HumanMessage(body));
            return { messages: outMessages };
        };
    }

    /**
     * Orchestrator node - decides whether to answer directly or delegate
     */
    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const messagesToSend = [
            new SystemMessage(this.implementationMetadata.systemInstruction),
            ...this.buildOrchestratorView(state.messages)
        ];

        try {
            const response = await this.agentLLM!.invoke(messagesToSend) as AIMessage;
            return { messages: [this.keepSingleDelegation(response)] };
        } catch (error) {
            console.error("[MainAgent] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
        }
    }

    /**
     * The orchestrator must delegate exactly ONE step per turn. If the model emits
     * several tool calls at once (parallel function calling), keep only the first
     * delegation — the extra ones would be left unanswered (dangling tool calls) and
     * break the conversation on the next turn. Dropped steps are re-delegated on later
     * turns, since the orchestrator re-plans from the full accumulated state.
     */
    private keepSingleDelegation(message: AIMessage): AIMessage {
        const toolCalls = message.tool_calls ?? [];
        if (toolCalls.length <= 1) {
            return message;
        }
        const first = toolCalls.find(tc => agentRegistry.getByToolName(tc.name)) ?? toolCalls[0];
        console.log(`[MainAgent] Collapsing ${toolCalls.length} parallel tool calls -> ${first.name}`);
        return new AIMessage({ content: message.content, tool_calls: [first] });
    }

    /**
     * Build a CLEAN conversation for the orchestrator LLM from the noisy accumulated
     * state. The shared MessagesAnnotation accumulates every sub-agent's internal tool
     * calls and messages; feeding those raw to the orchestrator confuses Gemini (it sees
     * function calls for tools it doesn't own) and breaks both the final answer and the
     * multi-step loop. This reconstructs only the well-formed supervisor view:
     *   user request  ->  delegate_to_X call  ->  ToolMessage(sub-agent result)  ->  ...
     */
    private buildOrchestratorView(messages: BaseMessage[]): BaseMessage[] {
        const isDelegation = (m: BaseMessage): boolean =>
            m instanceof AIMessage &&
            !!m.tool_calls?.some(tc => agentRegistry.getByToolName(tc.name));

        const view: BaseMessage[] = [];
        const firstHuman = messages.find(m => m instanceof HumanMessage);
        if (firstHuman) {
            view.push(firstHuman);
        }

        let i = 0;
        while (i < messages.length) {
            const m = messages[i];
            if (!isDelegation(m)) {
                i++;
                continue;
            }

            const ai = m as AIMessage;
            const delegationTc = ai.tool_calls!.find(tc => agentRegistry.getByToolName(tc.name))!;

            // The sub-agent's result is the last plain AIMessage (no tool calls) before
            // the next delegation.
            let j = i + 1;
            let result = "";
            while (j < messages.length && !isDelegation(messages[j])) {
                const mj = messages[j];
                if (
                    mj instanceof AIMessage &&
                    (!mj.tool_calls || mj.tool_calls.length === 0) &&
                    typeof mj.content === "string" &&
                    mj.content.trim().length > 0
                ) {
                    result = mj.content.trim();
                }
                j++;
            }

            const agentName = agentRegistry.getByToolName(delegationTc.name)?.name ?? delegationTc.name;
            // Use ONE consistent id on both the call and its response, and set the
            // ToolMessage `name`. Without a matching id + name the Gemini converter cannot
            // pair the function response to the call, so the orchestrator treats the
            // delegation as still-pending and re-emits the SAME delegate_to_* every turn
            // (e.g. forever re-running Search) instead of advancing to the next agent.
            const callId = delegationTc.id ?? `call_${view.length}_${delegationTc.name}`;
            view.push(new AIMessage({
                content: "",
                tool_calls: [{ name: delegationTc.name, args: delegationTc.args ?? {}, id: callId, type: "tool_call" }],
            }));
            view.push(new ToolMessage({
                tool_call_id: callId,
                name: delegationTc.name,
                content: result || `${agentName} returned no output.`,
            }));
            i = j;
        }

        return view;
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
            const messagesToSend = [
                new SystemMessage(mergedConfig.systemInstruction),
                ...this.buildOrchestratorView(state.messages)
            ];

            try {
                const response = await boundLLM.invoke(messagesToSend) as AIMessage;
                return { messages: [this.keepSingleDelegation(response)] };
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
                        // LLM streaming — block ONLY sub-agent token streams (their LLM
                        // node is named "agentNode") so intermediate agent outputs don't
                        // merge into the answer. Everything else (the orchestrator's own
                        // tokens, or any unknown source) is always forwarded, so the final
                        // answer can never be accidentally suppressed.
                        else if (event.event === ON_CHAT_MODEL_STREAM_EVENT) {
                            const streamNode = (event.metadata as any)?.langgraph_node;
                            if (streamNode !== "agentNode") {
                                enqueueJson({
                                    type: AGENT_STREAM,
                                    payload: { name: event.name, content: event.data.chunk, id: event.run_id }
                                });
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
