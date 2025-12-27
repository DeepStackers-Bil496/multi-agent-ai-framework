import { AgentConfig } from "./agentConfig";
import { AgentImplMetadata, AgentUserMetadata } from "../types";
import { MessagesAnnotation } from "@langchain/langgraph";

export abstract class BaseAgent<T extends AgentImplMetadata = AgentImplMetadata, M extends AgentUserMetadata = AgentUserMetadata> {
    protected readonly userMetadata: M;
    protected readonly implementationMetadata: T;

    /**
     * @param config Agent configuration
     */
    constructor(config: AgentConfig<T, M>) {
        this.userMetadata = config.user_metadata;
        this.implementationMetadata = config.implementation_metadata;
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
}
