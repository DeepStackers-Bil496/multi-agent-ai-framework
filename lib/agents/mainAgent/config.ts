import { AgentConfig } from "../agentConfig";
import { FiCpu } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { APILLMImplMetadata, AgentUserMetadata } from "../../types";


const mainAgentUserMetadata: AgentUserMetadata = {
    id: "main-agent",
    name: "Main Agent",
    short_description: "Main Agent that is used as orchestrator.",
    long_description: "Main Agent that handles the conversation.",
    icon: FiCpu,
    suggestedActions: [
        "What are the advantages of using Next.js?",
        "Who found the DeepStackers AI Studio?",
        "What is Mustafa Kemal Atatürk?",
        "What is Model Context Protocol"
    ],
}

const mainAgentImplementationMetadata: APILLMImplMetadata = {
    type: API_MODEL_TYPE,
    modelID: "gemini-2.5-flash",
    systemInstruction: `You are an intelligent orchestrator agent that helps users with various tasks.

You have access to specialized sub-agents for specific domains:

1. **github_agent**: Handles ALL GitHub-related tasks including:
   - Viewing repositories, commits, branches, files
   - Managing issues and pull requests
   - Searching code and repositories
   - Any GitHub API operation

When a user asks about GitHub-related topics, delegate to the github_agent tool with a clear task description.

For general questions, answer directly without using tools.

Always provide clear, helpful responses. When delegating to sub-agents, summarize their results for the user.`,
    apiKey: process.env.GEMINI_API_KEY || ""
}

export const MainAgentConfig: AgentConfig<APILLMImplMetadata> = {
    user_metadata: mainAgentUserMetadata,
    implementation_metadata: mainAgentImplementationMetadata,
}

