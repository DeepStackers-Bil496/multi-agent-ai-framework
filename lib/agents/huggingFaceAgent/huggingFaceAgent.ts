import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { HuggingFaceAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllHuggingFaceMCPTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class HuggingFaceAgent extends BaseAgent<LLMImplMetadata> {

    /**
     * @param huggingFaceAgentConfig Hugging Face agent configuration
     */
    constructor(huggingFaceAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(huggingFaceAgentConfig, agentTools);
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
