
import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { GitHubAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllGitHubMCPTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class GitHubAgent extends BaseAgent<LLMImplMetadata> {

    /**
     * @param githubAgentConfig GitHub agent configuration
     */
    constructor(githubAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(githubAgentConfig, agentTools);
    }
}

export const githubAgent = new GitHubAgent(GitHubAgentConfig, createAllGitHubMCPTools());

// Self-register with the agent registry
agentRegistry.register({
    id: githubAgent.id,
    name: githubAgent.name,
    toolName: "delegate_to_github",
    toolDescription: `Route the task to the GitHub Agent for processing.
Use this when the user asks about:
- GitHub repositories, commits, branches, tags, files
- Issues (list, create, update, comment)
- Pull requests (list, view, diff, reviews)
- Searching code or repositories
- Any GitHub API operation`,
    taskPrefix: "[GitHub Task]",
    instance: githubAgent,
    getCompiledGraph: () => githubAgent.getCompiledGraph(),
});

