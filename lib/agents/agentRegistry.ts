import { Runnable } from "@langchain/core/runnables";
import { AgentUserMetadata, AgentChatMessage } from "../types";

/**
 * Interface for agents that can be delegated to by the MainAgent.
 * Agents implementing this interface can self-register with the registry.
 */
export interface DelegatableAgent {
    /** Unique identifier, e.g., "github" */
    id: string;
    /** Display name, e.g., "GitHub Agent" */
    name: string;
    /** Tool name for LLM routing, e.g., "delegate_to_github" */
    toolName: string;
    /** Description shown to LLM for routing decisions */
    toolDescription: string;
    /** Prefix for task messages, e.g., "[GitHub Task]" */
    taskPrefix: string;
    /** The agent instance for running */
    instance: { run(inputMessages: AgentChatMessage[]): Promise<Response> };
    /** Returns the compiled LangGraph for this agent */
    getCompiledGraph: () => Runnable;
}

/**
 * Central registry for delegatable agents.
 * Agents register themselves at module load time.
 */
class AgentRegistry {
    private agents: Map<string, DelegatableAgent> = new Map();

    /**
     * Register an agent with the registry.
     * @param agent The delegatable agent to register
     */
    register(agent: DelegatableAgent): void {
        if (this.agents.has(agent.id)) {
            console.warn(`[AgentRegistry] Agent "${agent.id}" is already registered. Overwriting.`);
        }
        this.agents.set(agent.id, agent);
        console.log(`[AgentRegistry] Registered agent: ${agent.name} (${agent.id})`);
    }

    /**
     * Get all registered agents.
     * @returns Array of all registered delegatable agents
     */
    getAll(): DelegatableAgent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Find an agent by its delegation tool name.
     * @param toolName The tool name to search for
     * @returns The matching agent or undefined
     */
    getByToolName(toolName: string): DelegatableAgent | undefined {
        return this.getAll().find(agent => agent.toolName === toolName);
    }

    /**
     * Find an agent by its ID.
     * @param id The agent ID to search for
     * @returns The matching agent or undefined
     */
    getById(id: string): DelegatableAgent | undefined {
        return this.agents.get(id);
    }

    /**
     * Get count of registered agents.
     */
    get size(): number {
        return this.agents.size;
    }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();
