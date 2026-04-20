import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { GitHubAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllGitHubMCPTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";
import { MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createLLM } from "../llmFactory";

// Cache: token -> github login. Avoids re-hitting /user on every invocation.
const githubUsernameCache = new Map<string, string>();

async function resolveGitHubUsername(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    const clean = token.trim();
    if (!clean) return null;
    const cached = githubUsernameCache.get(clean);
    if (cached) return cached;
    try {
        const res = await fetch("https://api.github.com/user", {
            headers: {
                "Authorization": `Bearer ${clean}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "multi-agent-ai-framework",
            },
        });
        if (!res.ok) {
            console.warn(`[GitHubAgent] /user lookup failed: ${res.status}`);
            return null;
        }
        const data = (await res.json()) as { login?: string };
        if (data.login) {
            githubUsernameCache.set(clean, data.login);
            return data.login;
        }
        return null;
    } catch (err) {
        console.warn("[GitHubAgent] /user lookup errored:", err);
        return null;
    }
}

class GitHubAgent extends BaseAgent<LLMImplMetadata> {
    constructor(githubAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(githubAgentConfig, agentTools);
    }

    protected createTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
        return createAllGitHubMCPTools(runtimeSecrets);
    }

    private async buildSystemInstruction(baseInstruction: string): Promise<string> {
        const token = this.runtimeSecrets?.["GITHUB_PAT"] || process.env.GITHUB_PAT;
        const username = await resolveGitHubUsername(token);
        if (!username) return baseInstruction;
        return `Authenticated GitHub user: ${username} (use this as the default owner when the user says "my repo", "my issues", "my PRs", etc., unless they specify another owner).\n\n${baseInstruction}`;
    }

    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const systemInstruction = await this.buildSystemInstruction(
            this.implementationMetadata.systemInstruction
        );
        const messagesToSend = [new SystemMessage(systemInstruction), ...messages];

        try {
            console.log(`[${this.name}] Invoking LLM with auth-aware system prompt`);
            const response = await this.agentLLM!.invoke(messagesToSend);
            return { messages: [response] };
        } catch (error) {
            console.error(`[${this.name}] Error in agentNode:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
        }
    }

    public createRuntimeGraph(
        runtimeConfig?: Partial<LLMImplMetadata>,
        runtimeSecrets?: Record<string, string>
    ): Runnable {
        const mergedConfig: LLMImplMetadata = {
            ...(this.implementationMetadata as LLMImplMetadata),
            ...runtimeConfig,
            systemInstruction: (this.implementationMetadata as LLMImplMetadata).systemInstruction,
        };

        const secrets = runtimeSecrets || this.runtimeSecrets;
        const runtimeTools = this.createTools(secrets);
        const runtimeLLM = createLLM(mergedConfig);
        const boundLLM = runtimeLLM.bindTools!(runtimeTools);
        const toolNode = new ToolNode(runtimeTools);

        const buildSystem = async () => {
            const token = secrets?.["GITHUB_PAT"] || process.env.GITHUB_PAT;
            const username = await resolveGitHubUsername(token);
            if (!username) return mergedConfig.systemInstruction;
            return `Authenticated GitHub user: ${username} (use this as the default owner when the user says "my repo", "my issues", "my PRs", etc., unless they specify another owner).\n\n${mergedConfig.systemInstruction}`;
        };

        const runtimeAgentNode = async (state: typeof MessagesAnnotation.State) => {
            const { messages } = state;
            const systemInstruction = await buildSystem();
            const messagesToSend = [new SystemMessage(systemInstruction), ...messages];

            try {
                console.log(`[${this.name}] (Runtime) Invoking LLM with auth-aware system prompt`);
                const response = await boundLLM.invoke(messagesToSend);
                return { messages: [response] };
            } catch (error) {
                console.error(`[${this.name}] (Runtime) Error in agentNode:`, error);
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
