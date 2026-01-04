/**
 * CodebaseAgent
 * Specialized agent for answering questions about the codebase using RAG
 */

import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { CodebaseAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createCodebaseAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class CodebaseAgent extends BaseAgent<LLMImplMetadata> {
    /**
     * @param config CodebaseAgent configuration
     * @param agentTools Tools available to the agent
     */
    constructor(
        config: AgentConfig<LLMImplMetadata>,
        agentTools: DynamicStructuredTool[]
    ) {
        super(config, agentTools);
    }
}

export const codebaseAgent = new CodebaseAgent(
    CodebaseAgentConfig,
    createCodebaseAgentTools()
);

// Self-register with the agent registry
agentRegistry.register({
    id: codebaseAgent.id,
    name: codebaseAgent.name,
    toolName: "delegate_to_codebase",
    toolDescription: `Route the task to the Codebase Agent for code analysis and retrieval.
Use this when the user asks about:
- Code snippets, functions, classes, or files
- Code structure, architecture, or design
- Code implementation details
- Code documentation or comments`,
    taskPrefix: "[Codebase Task]",
    instance: codebaseAgent,
    getCompiledGraph: () => codebaseAgent.getCompiledGraph(),
});


