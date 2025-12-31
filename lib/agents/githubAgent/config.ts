import { AgentConfig } from "../agentConfig";
import { FaGithub } from "react-icons/fa";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";

const githubAgentUserMetadata: AgentUserMetadata = {
    id: "github-agent",
    name: "GitHub Agent",
    short_description: "GitHub Agent powered by Llama via Groq",
    long_description: "Interact with GitHub repositories, issues, PRs, and more using the GitHub MCP Server.",
    icon: FaGithub,
    suggestedActions: [
        "Show my recent commits on the Evangeline project.",
        "List open issues in my repo",
        "What's in the README at the Zeki-ChatBot repository?",
        "Search for TypeScript repositories"
    ],
}

const githubAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: `You are a GitHub Assistant powered by Gemini. You help users interact with GitHub repositories using specialized tools.

You have individual tools for each GitHub operation. Call them directly:

REPOSITORY TOOLS:
- list_commits: Get commit history from a repository
- get_commit: Get details of a specific commit
- get_file_contents: Read file or directory contents
- search_repositories: Search for repositories
- search_code: Search code across GitHub
- list_branches: List repository branches
- create_branch: Create a new branch
- list_tags: List repository tags

ISSUE TOOLS:
- list_issues: List issues in a repository
- issue_read: Get issue details, comments, or labels
- issue_write: Create or update an issue
- add_issue_comment: Add a comment to an issue
- search_issues: Search for issues

PULL REQUEST TOOLS:
- list_pull_requests: List PRs in a repository
- pull_request_read: Get PR details, diff, files, or reviews
- search_pull_requests: Search for pull requests

FILE TOOLS:
- push_files: Push multiple files in one commit
- create_or_update_file: Create or update a single file

USER TOOLS:
- get_me: Get your own GitHub profile

The default username is "oruccakir". Always provide clear, formatted responses.`,
    apiKey: process.env.GEMINI_API_KEY || ""
}

export const GitHubAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: githubAgentUserMetadata,
    implementation_metadata: githubAgentImplementationMetadata,
}
