import { AgentConfig } from "../agentConfig";
import { FaGithub } from "react-icons/fa";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { githubAgentSystemPrompt } from "./prompt";

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
    provider: "ollama",
    modelID: "qwen2.5:14b",
    systemInstruction: githubAgentSystemPrompt,
    apiKey: "",
    baseURL: process.env.GITHUB_AGENT_DEPLOYMENT_BASE_URL,
}

export const GitHubAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: githubAgentUserMetadata,
    implementation_metadata: githubAgentImplementationMetadata,
}
