import { AgentConfig } from "../agentConfig";
import { FiGlobe } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { webAgentSystemPrompt } from "./prompt";

const webAgentUserMetadata: AgentUserMetadata = {
    id: "web-agent",
    name: "Web Agent",
    short_description: "Web content extraction and scraping",
    long_description: "Fetch and parse web pages to extract text, links, and metadata.",
    icon: FiGlobe,
    suggestedActions: [
        "What is the title of this webpage?",
        "Extract all links from this page",
        "Search this link https://www.etu.edu.tr/tr",
        "Scrape the metadata from this website"
    ],
}

const webAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "ollama",
    modelID: "llama3.2:3b-instruct-q4_K_M",
    systemInstruction: webAgentSystemPrompt,
    apiKey: "",
    baseURL: "https://ollama-service-339531297198.us-central1.run.app"
}
export const WebAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: webAgentUserMetadata,
    implementation_metadata: webAgentImplementationMetadata,
}
