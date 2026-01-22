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
        "Search for the latest news on AI",
        "Find research papers about transformer architectures",
        "Scrape the content from this URL: https://example.com",
        "Extract all links from this webpage"
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
