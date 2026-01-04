import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { WebAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllWebAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class WebAgent extends BaseAgent<LLMImplMetadata> {

    constructor(webAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(webAgentConfig, agentTools);
    }
}

export const webAgent = new WebAgent(WebAgentConfig, createAllWebAgentTools());

// Self-register with the agent registry
agentRegistry.register({
    id: webAgent.id,
    name: webAgent.name,
    toolName: "delegate_to_webscraper",
    toolDescription: `Route the task to the Web Scraper Agent for web content extraction.
Use this when the user asks to:
- Fetch or scrape content from a URL
- Extract text, links, or metadata from a webpage
- Get information from a website
- Analyze web page content`,
    taskPrefix: "[Web Task]",
    instance: webAgent,
    getCompiledGraph: () => webAgent.getCompiledGraph(),
});

