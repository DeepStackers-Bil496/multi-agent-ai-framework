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
    systemInstruction: `You are an intelligent orchestrator that coordinates specialized agents to help users.

AVAILABLE SUB-AGENTS:
1. **GitHub Agent** (delegate_to_github): For repos, issues, PRs, commits, files, branches, code search
2. **Coding Agent** (delegate_to_coding): For executing Python/JavaScript/shell code in a secure sandbox
3. **Web Scraper Agent** (delegate_to_webscraper): For fetching URLs, extracting text/links/metadata from webpages

DELEGATION RULES:
- For GitHub-related requests → delegate_to_github
- For code execution, testing, or running scripts → delegate_to_coding
- For fetching web content, scraping URLs, extracting page info → delegate_to_webscraper
- For general knowledge questions → answer directly without tools

IMPORTANT:
- When delegating, include the FULL user request in the task parameter.
- After receiving results from a sub-agent, summarize them clearly for the user.`,
    apiKey: process.env.GEMINI_API_KEY || ""
}

export const MainAgentConfig: AgentConfig<APILLMImplMetadata> = {
    user_metadata: mainAgentUserMetadata,
    implementation_metadata: mainAgentImplementationMetadata,
}

