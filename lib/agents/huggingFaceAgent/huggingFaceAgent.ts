import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { HuggingFaceAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllHuggingFaceMCPTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";
import { MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createLLM } from "../llmFactory";

class HuggingFaceAgent extends BaseAgent<LLMImplMetadata> {

    /**
     * @param huggingFaceAgentConfig Hugging Face agent configuration
     */
    constructor(huggingFaceAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(huggingFaceAgentConfig, agentTools);
    }

    /**
     * Create HuggingFace MCP tools, passing runtime secrets when available
     */
    protected createTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
        return createAllHuggingFaceMCPTools(runtimeSecrets);
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

export const huggingFaceAgent = new HuggingFaceAgent(HuggingFaceAgentConfig, createAllHuggingFaceMCPTools());

// Self-register with the agent registry
agentRegistry.register({
    id: huggingFaceAgent.id,
    name: huggingFaceAgent.name,
    toolName: "delegate_to_huggingface",
    toolDescription: `Route the task to the Hugging Face Agent for processing.
Use this when the user asks about:
- ML models (search, details, trending, by task type or library)
- Datasets (search, details, by tags or author)
- ML research papers (search, summaries)
- Hugging Face Spaces (search, MCP-enabled Spaces)
- Hugging Face documentation (transformers, diffusers, hub, gradio)
- Running ML tasks via Spaces (image generation, OCR, TTS, background removal, etc.)
- Any Hugging Face Hub operation`,
    taskPrefix: "[HuggingFace Task]",
    instance: huggingFaceAgent,
    getCompiledGraph: () => huggingFaceAgent.getCompiledGraph(),
});
