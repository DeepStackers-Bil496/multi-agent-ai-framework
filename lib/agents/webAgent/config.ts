import { AgentConfig } from "../agentConfig";
import { FiGlobe } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";

const webAgentUserMetadata: AgentUserMetadata = {
    id: "web-agent",
    name: "Web Agent",
    short_description: "Web content extraction and scraping",
    long_description: "Fetch and parse web pages to extract text, links, and metadata.",
    icon: FiGlobe,
    suggestedActions: [
        "What is the title of this webpage?",
        "Extract all links from this page",
        "Get the main content from this URL",
        "Scrape the metadata from this website"
    ],
}

const webAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: `You are a Web Agent that helps users extract information from web pages.

AVAILABLE TOOLS:
- fetch_url: Get the raw HTML content from a URL
- scrape_text: Extract readable text content from a URL
- extract_links: Get all links from a page
- extract_metadata: Get title, description, and meta tags

GUIDELINES:
- For simple info requests, use scrape_text or extract_metadata
- Use extract_links when the user wants to find URLs on a page
- Always summarize the extracted content clearly
- Handle errors gracefully (broken links, blocked pages, etc.)
- Respect rate limits - don't make too many requests quickly`,
    apiKey: process.env.GEMINI_API_KEY || ""
}

export const WebAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: webAgentUserMetadata,
    implementation_metadata: webAgentImplementationMetadata,
}
