import { AgentConfig } from "../agentConfig";
import { SiHuggingface } from "react-icons/si";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { huggingFaceAgentSystemPrompt } from "./prompt";

const huggingFaceAgentUserMetadata: AgentUserMetadata = {
    id: "huggingface-agent",
    name: "HuggingFace Agent",
    short_description: "Search the Hugging Face Hub and run ML tasks on Spaces.",
    long_description: "Search and discover ML models, datasets, papers, and Spaces on the Hugging Face Hub. Fetch detailed repo metadata and product docs. Invoke MCP-enabled Spaces for image generation, OCR, TTS, transcription, and more.",
    icon: SiHuggingface,
    suggestedActions: [
        "Top 10 trending text-generation models right now.",
        "Find datasets tagged `sentiment-analysis`, sorted by downloads.",
        "Show details for `stabilityai/stable-diffusion-3`.",
        "Search papers on vision transformers.",
        "List MCP-enabled Spaces for OCR.",
        "Invoke an MCP Space to transcribe an audio file at <URL>.",
    ],
}

const huggingFaceAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: huggingFaceAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY,
}

export const HuggingFaceAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: huggingFaceAgentUserMetadata,
    implementation_metadata: huggingFaceAgentImplementationMetadata,
}
