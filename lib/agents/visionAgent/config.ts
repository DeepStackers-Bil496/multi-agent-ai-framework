import { AgentConfig } from "../agentConfig";
import { FiEye } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { visionAgentSystemPrompt } from "./prompt";

const visionAgentUserMetadata: AgentUserMetadata = {
    id: "vision-agent",
    name: "Vision Agent",
    short_description: "Image analysis and generation",
    long_description: "Analyze images for content, text (OCR), objects, charts, and UI elements. Generate high-quality images from text descriptions. Powered by state-of-the-art vision-language models.",
    icon: FiEye,
    suggestedActions: [
        "What's in this image?",
        "Extract all text from this screenshot (OCR).",
        "Describe the chart in this figure in one paragraph.",
        "Generate an image of a minimalist dashboard on a dark background.",
        "Identify the UI components and color palette in this screenshot.",
        "Recreate this image in a watercolor illustration style.",
    ],
};

const visionAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: visionAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY,
};

export const VisionAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: visionAgentUserMetadata,
    implementation_metadata: visionAgentImplementationMetadata,
};
