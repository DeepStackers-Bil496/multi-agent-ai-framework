import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { agentRegistry } from "../agentRegistry";

/**
 * Create delegation tools dynamically from the agent registry.
 * These tools signal the router where to delegate tasks.
 * @returns Array of delegation tools, one per registered agent
 */
export function createDelegationToolsFromRegistry(): DynamicStructuredTool[] {
    return agentRegistry.getAll().map(agent =>
        new DynamicStructuredTool({
            name: agent.toolName,
            description: agent.toolDescription,
            schema: z.object({
                task: z.string().describe(`The task to delegate to the ${agent.name}.`),
            }),
            func: async ({ task }) => `Delegating to ${agent.name}: ${task}`,
        })
    );
}
