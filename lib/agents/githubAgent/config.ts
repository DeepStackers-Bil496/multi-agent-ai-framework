import { AgentConfig } from "../agentConfig";
import { FaGithub } from "react-icons/fa";
import { API_MODEL_TYPE } from "../../constants";
import { APILLMImplMetadata, AgentUserMetadata } from "../../types";

const githubAgentUserMetadata: AgentUserMetadata = {
    id: "github-agent",
    name: "GitHub Agent",
    short_description: "GitHub Agent powered by Llama via Groq",
    long_description: "Interact with GitHub repositories, issues, PRs, and more using the GitHub MCP Server.",
    icon: FaGithub,
    suggestedActions: [
        "Show my recent commits on the Evangeline project.",
        "List open issues in my repo",
        "What's in the README?",
        "Search for TypeScript repositories"
    ],
}

const githubAgentImplementationMetadata: APILLMImplMetadata = {
    type: API_MODEL_TYPE,
    modelID: "llama-3.1-8b-instant", // Smaller model, uses fewer tokens
    systemInstruction: `You are a GitHub Assistant powered by Llama. You help users interact with GitHub repositories using MCP tools.

When users ask about GitHub-related tasks, use the appropriate tool:
- For commits: use list_commits, get_commit
- For issues: use list_issues, get_issue, create_issue, add_issue_comment
- For PRs: use list_pull_requests, pull_request_read
- For files: use get_file_contents, create_or_update_file
- For search: use search_repositories, search_code, search_issues
The username is always "oruccakir".
Always provide clear, formatted responses with relevant information.`,
    apiKey: process.env.GROQ_API_KEY || ""
}

export const GitHubAgentConfig: AgentConfig<APILLMImplMetadata> = {
    user_metadata: githubAgentUserMetadata,
    implementation_metadata: githubAgentImplementationMetadata,
}
