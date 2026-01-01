
import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { GitHubAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllGitHubMCPTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";

class GitHubAgent extends BaseAgent<LLMImplMetadata> {

    /**
     * @param githubAgentConfig GitHub agent configuration
     */
    constructor(githubAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(githubAgentConfig, agentTools);
    }
}

export const githubAgent = new GitHubAgent(GitHubAgentConfig, createAllGitHubMCPTools());
