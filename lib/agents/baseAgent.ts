import { AgentConfig, AgentMetadata } from "./agentConfig";
import { AgentImplementation } from "../types";
import { MessagesAnnotation } from "@langchain/langgraph";

export abstract class BaseAgent<T extends AgentImplementation = AgentImplementation, M extends AgentMetadata = AgentMetadata> {
    protected readonly metadata: M;
    protected readonly implementation: T;

    /**
     * @param config Agent configuration
     */
    constructor(config: AgentConfig<T, M>) {
        this.metadata = config.metadata;
        this.implementation = config.implementation;
    }

    /**
     * @returns JSON representation of the agent
     */
    public toJSON() {
        return {
            metadata: this.metadata,
            implementation_type: this.implementation.type
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
}
