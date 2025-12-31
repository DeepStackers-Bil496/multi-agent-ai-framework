import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentConfig } from "./agentConfig";
import { AgentImplMetadata, AgentUserMetadata, LLMImplMetadata } from "../types";
import { MessagesAnnotation } from "@langchain/langgraph";
import { Runnable } from "@langchain/core/runnables";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createLLM } from "./llmFactory";
import { API_MODEL_TYPE } from "../constants";

export abstract class BaseAgent<T extends AgentImplMetadata = AgentImplMetadata, M extends AgentUserMetadata = AgentUserMetadata> {
    // These two config will be assigned in the constructor
    protected readonly userMetadata: M;
    protected readonly implementationMetadata: T;

    // These will be assigned in the corresponding subclass constructor
    protected agentTools: DynamicStructuredTool[] = [];
    protected agentGraph: Runnable | null = null;
    protected agentLLM: Runnable | null = null;

    /**
     * @param config Agent configuration
     */
    constructor(config: AgentConfig<T, M>) {
        this.userMetadata = config.user_metadata;
        this.implementationMetadata = config.implementation_metadata;
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
     * Every agent must implement this method.
     * In langGraph, this method is used as the agent node.
     * We will be use these methods at the @mainAgentGraph .
     * @param state Agent state
     * @returns Agent node implementation
     */
    protected abstract agentNode(state: typeof MessagesAnnotation.State): Promise<Partial<typeof MessagesAnnotation.State>>;

    /**
     * Get the compiled graph for this agent.
     * Used for embedding this agent as a subgraph node in a parent graph.
     * @returns Compiled LangGraph Runnable
     */
    public abstract getCompiledGraph(): Runnable;
}
