import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { SearchAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";
import { createAllSearchAgentTools } from "./tools";

class SearchAgent extends BaseAgent<LLMImplMetadata> {
    constructor(
        searchAgentConfig: AgentConfig<LLMImplMetadata>,
        agentTools: DynamicStructuredTool[]
    ) {
        super(searchAgentConfig, agentTools);
    }

    /**
     * Create Search tools, passing runtime secrets for Exa API key
     */
    protected createTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
        return createAllSearchAgentTools(runtimeSecrets);
    }
}

export const searchAgent = new SearchAgent(
    SearchAgentConfig,
    createAllSearchAgentTools()
);

// Self-register with the agent registry
agentRegistry.register({
    id: searchAgent.id,
    name: searchAgent.name,
    toolName: "delegate_to_search",
    toolDescription: `Route search, research, and web scraping tasks here.
Use this when the user asks to:
- Search the web for information
- Find news articles or current events
- Search for academic papers or research (arXiv, Semantic Scholar)
- Fetch or scrape content from a URL
- Extract text, links, or metadata from a webpage
- Read the content of a webpage or article
- Research a topic by searching and reading sources

This agent provides: web search, news search, academic paper search, AND web scraping (fetch URLs, extract text/links/metadata).`,
    taskPrefix: "[Search Task]",
    instance: searchAgent,
    getCompiledGraph: () => searchAgent.getCompiledGraph(),
});
