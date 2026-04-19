import { AgentConfig } from "../agentConfig";
import { FiSearch } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { searchAgentSystemPrompt } from "./prompt";

const searchAgentUserMetadata: AgentUserMetadata = {
    id: "search-agent",
    name: "Search Agent",
    short_description: "Web search and content extraction",
    long_description: "Search the web, news, and academic papers. Extract text, links, and metadata from any webpage. Powered by DuckDuckGo, arXiv, and Semantic Scholar.",
    icon: FiSearch,
    suggestedActions: [
        "Search the web for the latest LangGraph release notes.",
        "Find arXiv papers on mixture-of-experts published this year.",
        "Scrape the article at <URL> and extract the main points.",
        "Get today's top AI news headlines.",
        "List all outbound links on <URL>.",
        "Pull the Open Graph metadata from <URL>.",
    ],
};

const searchAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: searchAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY,
};

export const SearchAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: searchAgentUserMetadata,
    implementation_metadata: searchAgentImplementationMetadata,
};
