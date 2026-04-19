import { AgentConfig } from "../agentConfig";
import { FaGithub } from "react-icons/fa";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { githubAgentSystemPrompt } from "./prompt";

const githubAgentUserMetadata: AgentUserMetadata = {
    id: "github-agent",
    name: "GitHub Agent",
    short_description: "GitHub operations: repos, commits, PRs, issues, code search.",
    long_description:
        "Read and write GitHub state through the official MCP server: repos, commits, branches, files, issues, pull requests, and code search across GitHub.",
    icon: FaGithub,
    suggestedActions: [
        "List my open pull requests across all my repos.",
        "Show the diff of the latest commit in <owner>/<repo>.",
        "Search code for `useEffect` across my repos.",
        "Open an issue in <owner>/<repo> titled 'bug: X' with reproduction steps.",
        "Create a branch `feature/Y` from main in <owner>/<repo>.",
        "Summarize who authored what in the last 20 commits of <owner>/<repo>.",
    ],
}

const githubAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: githubAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY,
}

export const GitHubAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: githubAgentUserMetadata,
    implementation_metadata: githubAgentImplementationMetadata,
}
