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
