import { AgentConfig } from "../agentConfig";
import { FiCpu } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { mainAgentSystemPrompt } from "./prompt";

const mainAgentUserMetadata: AgentUserMetadata = {
    id: "main-agent",
    name: "Main Agent",
    short_description: "Orchestrator that chains specialized agents to complete complex tasks end-to-end.",
    long_description:
        "Plans and executes multi-step tasks by delegating to specialized agents (GitHub, Search, Vision, Coding, Data Analyst, Google Workspace, Hugging Face, Codebase, Frontend) in sequence, carrying context between steps so the user only sees the final synthesized result.",
    icon: FiCpu,
    suggestedActions: [
        "Find the latest arXiv paper on retrieval-augmented generation, summarize its key contributions, and draft an email about it",
        "Check my last 3 commits in the Evangeline repo, analyze how they changed the codebase, and suggest what tests to add.",
        "Search Hugging Face for trending text-to-image models, pick the most popular summarize it to me",
        "Scrape the release notes from https://oruccakir.live ",
    ],
}

const mainAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: mainAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY || ""
}

export const MainAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: mainAgentUserMetadata,
    implementation_metadata: mainAgentImplementationMetadata,
}
