import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { SearchAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";
import { createAllSearchAgentTools } from "./tools";
import { MessagesAnnotation } from "@langchain/langgraph";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createLLM } from "../llmFactory";
import { START, StateGraph } from "@langchain/langgraph";

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

    /**
     * Override agentNode to inject current date into system prompt
     */
    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        });

        const systemInstructionWithDate = `Today is ${dateStr}.\n\n${this.implementationMetadata.systemInstruction}`;

        const messagesToSend = [new SystemMessage(systemInstructionWithDate), ...this.sanitizeMessagesForLLM(messages)];

        try {
            console.log(`[${this.name}] Invoking LLM with date awareness: ${dateStr}`);
            const response = await this.agentLLM!.invoke(messagesToSend);
            return { messages: [response] };
        } catch (error) {
            console.error(`[${this.name}] Error in agentNode:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                messages: [new AIMessage(`Error: ${errorMessage}`)],
            };
        }
    }

    /**
     * Override createRuntimeGraph to inject current date into system prompt
     */
    public createRuntimeGraph(
        runtimeConfig?: Partial<LLMImplMetadata>,
        runtimeSecrets?: Record<string, string>
    ): Runnable {
        const mergedConfig: LLMImplMetadata = {
            ...(this.implementationMetadata as LLMImplMetadata),
            ...runtimeConfig,
            systemInstruction: (this.implementationMetadata as LLMImplMetadata).systemInstruction,
        };

        const secrets = runtimeSecrets || this.runtimeSecrets;
        const runtimeTools = this.createTools(secrets);
        const runtimeLLM = createLLM(mergedConfig);
        const boundLLM = runtimeLLM.bindTools!(runtimeTools);
        const toolNode = new ToolNode(runtimeTools);

        const runtimeAgentNodeWithDate = async (state: typeof MessagesAnnotation.State) => {
            const { messages } = state;
            const now = new Date();
            const dateStr = now.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
            });

            const systemInstructionWithDate = `Today is ${dateStr}.\n\n${mergedConfig.systemInstruction}`;

            const messagesToSend = [new SystemMessage(systemInstructionWithDate), ...this.sanitizeMessagesForLLM(messages)];

            try {
                console.log(`[${this.name}] (Runtime) Invoking LLM with date awareness: ${dateStr}`);
                const response = await boundLLM.invoke(messagesToSend);
                return { messages: [response] };
            } catch (error) {
                console.error(`[${this.name}] (Runtime) Error in agentNode:`, error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
            }
        };

        return new StateGraph(MessagesAnnotation)
            .addNode("agentNode", runtimeAgentNodeWithDate)
            .addNode("tools", toolNode)
            .addEdge(START, "agentNode")
            .addConditionalEdges("agentNode", this.agentRoute.bind(this))
            .addEdge("tools", "agentNode")
            .compile();
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
