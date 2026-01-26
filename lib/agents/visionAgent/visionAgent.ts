import { DynamicStructuredTool } from "@langchain/core/tools";
import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { BaseAgent } from "../baseAgent";
import { agentRegistry } from "../agentRegistry";
import { VisionAgentConfig } from "./config";
import { createAllVisionAgentTools } from "./tools";

/**
 * VisionAgent - Specialized agent for image analysis and generation
 *
 * Capabilities:
 * - Image Analysis: OCR, object detection, chart interpretation, UI analysis, style analysis
 * - Image Generation: Text-to-image using state-of-the-art diffusion models
 *
 * Uses:
 * - Google Gemini Vision for multimodal analysis
 * - Hugging Face Inference API for image generation
 */
class VisionAgent extends BaseAgent<LLMImplMetadata> {
    constructor(
        config: AgentConfig<LLMImplMetadata>,
        agentTools: DynamicStructuredTool[]
    ) {
        super(config, agentTools);
    }

    /**
     * Create tools with runtime secrets for API access
     */
    protected createTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
        return createAllVisionAgentTools(runtimeSecrets);
    }
}

// Create singleton instance
export const visionAgent = new VisionAgent(
    VisionAgentConfig,
    createAllVisionAgentTools()
);

// Self-register with agent registry for MainAgent orchestration
agentRegistry.register({
    id: visionAgent.id,
    name: visionAgent.name,
    toolName: "delegate_to_vision",
    toolDescription: `Route image-related tasks here:
- Image analysis: "What is in this image?", "Describe this photo", "What does this show?"
- Text extraction (OCR): "Extract text from this screenshot", "Read the text in this image"
- Chart/graph interpretation: "Analyze this chart", "What does this graph show?"
- UI analysis: "Analyze this UI screenshot", "What elements are in this interface?"
- Image generation: "Create an image of...", "Generate a picture of...", "Draw..."
- Style analysis: "What style is this image?", "Analyze the colors and design"`,
    taskPrefix: "[Vision Task]",
    instance: visionAgent,
    getCompiledGraph: () => visionAgent.getCompiledGraph(),
});
