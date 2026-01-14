import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentConfig } from "./agentConfig";
import { AgentChatMessage, AgentImplMetadata, AgentUserMetadata, LLMImplMetadata } from "../types";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { Runnable } from "@langchain/core/runnables";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createLLM } from "./llmFactory";
import { AGENT_ENDED, AGENT_ERROR, AGENT_STARTED, AGENT_STREAM, AgentUserRole, API_MODEL_TYPE, ON_CHAT_MODEL_STREAM_EVENT, TOOL_ENDED, TOOL_ENDED_EVENT, TOOL_STARTED, TOOL_STARTED_EVENT } from "../constants";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";

export abstract class BaseAgent<T extends AgentImplMetadata = AgentImplMetadata, M extends AgentUserMetadata = AgentUserMetadata> {
    // These two config will be assigned in the constructor
    protected readonly userMetadata: M;
    protected readonly implementationMetadata: T;

    // These will be assigned in the corresponding subclass constructor
    protected agentTools: DynamicStructuredTool[] = [];
    protected agentGraph: Runnable | null = null;
    protected agentLLM: Runnable | null = null;
    protected runtimeSecrets?: Record<string, string>;

    /**
     * @param config Agent configuration
     */
    constructor(config: AgentConfig<T, M>, agentTools: DynamicStructuredTool[]) {
        this.userMetadata = config.user_metadata;
        this.implementationMetadata = config.implementation_metadata;
        this.agentTools = agentTools;
        console.log(`[${this.name}] Initializing with provider: ${this.implementationMetadata.provider}`);
        const llm = this.createLLMFromConfig();
        this.agentLLM = llm.bindTools!(this.agentTools);
        this.agentGraph = this.buildAgentGraph();
        console.log(`[${this.name}] Agent graph built successfully`);
    }

    /**
     * Create an LLM instance based on the agent's config.
     * Uses the factory pattern to support multiple providers.
     * @returns BaseChatModel instance
     */
    protected createLLMFromConfig(): BaseChatModel {
        // Only API type metadata has provider info
        if (this.implementationMetadata.type !== API_MODEL_TYPE) {
            throw new Error("createLLMFromConfig only supports API_MODEL_TYPE");
        }

        return createLLM(this.implementationMetadata as LLMImplMetadata);
    }

    /**
     * @returns JSON representation of the agent
     */
    public toJSON() {
        return {
            user_metadata: this.userMetadata,
            implementation_metadata: this.implementationMetadata
        };
    }

    /**
     * Get the agent's display name
     */
    public get name(): string {
        return this.userMetadata.name;
    }

    /**
     * Get the agent's ID
     */
    public get id(): string {
        return this.userMetadata.id;
    }

    /**
     * Abstract method that each agent must implement to create its tools.
     * This allows runtime secrets to be passed to tools when available.
     * @param runtimeSecrets Optional secrets from database for API authentication
     * @returns Array of tools for this agent
     */
    protected abstract createTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[];

    /**
     * Build the agent graph with the current tools
     */
    protected buildAgentGraph() {
        const toolNode = new ToolNode(this.agentTools);
        return new StateGraph(MessagesAnnotation)
            .addNode("agentNode", this.agentNode.bind(this))
            .addNode("tools", toolNode)
            .addEdge(START, "agentNode")
            .addConditionalEdges("agentNode", this.agentRoute.bind(this))
            .addEdge("tools", "agentNode")
            .compile();
    }

    /**
     * Every agent must implement this method.
     * In langGraph, this method is used as the agent node.
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
            console.log("[" + this.name + "] Invoking LLM with", messages.length, "messages");
            const response = await this.agentLLM!.invoke(messagesToSend);

            // Debug: log what we got back
            const aiResponse = response as AIMessage;
            console.log("[" + this.name + "] Response received:", {
                hasContent: !!aiResponse.content,
                contentLength: typeof aiResponse.content === 'string' ? aiResponse.content.length : 0,
                hasToolCalls: !!(aiResponse.tool_calls && aiResponse.tool_calls.length > 0),
                toolCallsCount: aiResponse.tool_calls?.length || 0
            });

            // If response is empty, return a fallback message
            if (!aiResponse.content && (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0)) {
                console.warn("[" + this.name + "] Empty response from LLM, returning fallback");
                return {
                    messages: [new AIMessage("I apologize, but I couldn't process that request. Please try again or rephrase your question.")]
                }
            }

            return {
                messages: [response]
            }
        } catch (error) {
            console.error("[" + this.name + "] Error in agentNode:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                messages: [new AIMessage(`Error: ${errorMessage}`)]
            }
        }
    }

    /**
     * Get the compiled graph for this agent.
     * Used for embedding this agent as a subgraph node in a parent graph.
     * @returns Compiled LangGraph Runnable
     */
    public getCompiledGraph(): Runnable {
        return this.agentGraph!;
    }


    /**
     * This method is used to route the agent to the correct tool or end.
     * @param state Agent state
     * @returns Agent route
     */
    protected agentRoute(state: typeof MessagesAnnotation.State) {
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
     * Get a secret value, checking runtime secrets first, then falling back to env vars.
     * This allows user-configured secrets from the database to take precedence.
     * @param key The secret key to retrieve
     * @param envVarName Optional environment variable name to use as fallback
     * @returns The secret value or undefined
     */
    protected getSecret(key: string, envVarName?: string): string | undefined {
        // First check runtime secrets (from database)
        if (this.runtimeSecrets?.[key]) {
            return this.runtimeSecrets[key];
        }

        // Fall back to environment variable
        return process.env[envVarName || key];
    }

    /**
     * Creates a temporary graph with runtime-specific LLM configuration.
     * Used when user has custom configuration that differs from defaults.
     * @param runtimeConfig Runtime configuration overrides
     * @returns Compiled graph with the runtime-configured LLM
     */
    /**
     * Creates a temporary graph with runtime-specific LLM configuration.
     * Used when user has custom configuration that differs from defaults.
     * @param runtimeConfig Runtime configuration overrides
     * @param runtimeSecrets Optional runtime secrets for tools
     * @returns Compiled graph with the runtime-configured LLM
     */
    public createRuntimeGraph(
        runtimeConfig?: Partial<LLMImplMetadata>,
        runtimeSecrets?: Record<string, string>
    ): Runnable {
        // Merge runtime config with default implementation metadata
        const mergedConfig: LLMImplMetadata = {
            ...this.implementationMetadata as LLMImplMetadata,
            ...runtimeConfig,
            // Always preserve the system instruction from agent defaults
            systemInstruction: (this.implementationMetadata as LLMImplMetadata).systemInstruction,
        };

        console.log(`[${this.name}] Creating runtime LLM with provider: ${mergedConfig.provider}, model: ${mergedConfig.modelID}`);

        // Create tools with runtime secrets if available (or use existing)
        const secrets = runtimeSecrets || this.runtimeSecrets;
        const runtimeTools = this.createTools(secrets);

        // Create new LLM with merged config
        const runtimeLLM = createLLM(mergedConfig);
        const boundLLM = runtimeLLM.bindTools!(runtimeTools);

        // Build a new graph with the runtime LLM and tools
        const toolNode = new ToolNode(runtimeTools);
        const runtimeAgentNode = async (state: typeof MessagesAnnotation.State) => {
            const { messages } = state;
            const messagesToSend = [
                new SystemMessage(mergedConfig.systemInstruction),
                ...messages
            ];

            try {
                console.log("[" + this.name + "] (Runtime) Invoking LLM with", messages.length, "messages");
                const response = await boundLLM.invoke(messagesToSend);
                const aiResponse = response as AIMessage;

                if (!aiResponse.content && (!aiResponse.tool_calls || aiResponse.tool_calls.length === 0)) {
                    console.warn("[" + this.name + "] (Runtime) Empty response from LLM, returning fallback");
                    return {
                        messages: [new AIMessage("I apologize, but I couldn't process that request. Please try again.")]
                    };
                }

                return { messages: [response] };
            } catch (error) {
                console.error("[" + this.name + "] (Runtime) Error in agentNode:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
            }
        };

        return new StateGraph(MessagesAnnotation)
            .addNode("agentNode", runtimeAgentNode)
            .addNode("tools", toolNode)
            .addEdge(START, "agentNode")
            .addConditionalEdges("agentNode", this.agentRoute.bind(this))
            .addEdge("tools", "agentNode")
            .compile();
    }

    /**
     * Run the agent with the given input messages.
     * @param inputMessages Input messages
     * @param runtimeConfig Optional runtime configuration overrides (user-specific settings)
     * @param runtimeSecrets Optional runtime secrets from database (user-specific credentials)
     * @returns Agent response
     */
    public async run(
        inputMessages: AgentChatMessage[],
        runtimeConfig?: Partial<LLMImplMetadata>,
        runtimeSecrets?: Record<string, string>
    ): Promise<Response> {
        const history = inputMessages.map((message) => {
            return message.role == AgentUserRole
                ? new HumanMessage(message.content)
                : new AIMessage(message.content);
        });

        // Store runtime secrets for tools to access
        this.runtimeSecrets = runtimeSecrets;

        // Use runtime graph if config provided, otherwise use default graph
        const graphToUse = runtimeConfig && Object.keys(runtimeConfig).length > 0
            ? this.createRuntimeGraph(runtimeConfig, runtimeSecrets)
            : this.agentGraph!;

        const eventStream = graphToUse.streamEvents(
            { messages: history },
            { version: "v2" }
        );

        // Capture metadata before callback (callback has different 'this' context)
        const agentName = this.userMetadata.name;
        const agentId = this.userMetadata.id;

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

                    console.log("[" + agentName + "] Agent started");

                    for await (const event of eventStream) {
                        // Tool execution started
                        if (event.event === TOOL_STARTED_EVENT && event.name === "tools") {
                            // Extract actual tool name from input messages
                            let toolName = "tool";
                            const inputMsgs = event.data.input?.messages;
                            if (inputMsgs && inputMsgs.length > 0) {
                                const lastMsg = inputMsgs[inputMsgs.length - 1];
                                if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
                                    toolName = lastMsg.tool_calls[0].name;
                                }
                            }
                            console.log("[" + agentName + "] Tool name:", toolName + " is called");

                            enqueueJson({
                                type: TOOL_STARTED,
                                payload: {
                                    name: toolName,
                                    content: JSON.stringify(event.data.input),
                                    id: event.run_id
                                }
                            });
                        }
                        // Tool execution ended
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
                            console.log("[" + agentName + "] Tool name:", toolName + " is ended");

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
                    console.error("[" + agentName + "] CRITICAL ERROR inside stream loop:", error);
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
                    console.log("[" + agentName + "] Agent ended");
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
