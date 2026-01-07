import { AgentConfig } from "../agentConfig";
import { SiHuggingface } from "react-icons/si";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { huggingFaceAgentSystemPrompt } from "./prompt";

const huggingFaceAgentUserMetadata: AgentUserMetadata = {
    id: "huggingface-agent",
    name: "HuggingFace Agent",
    short_description: "HuggingFace Agent powered by Gemini",
    long_description: "Search and discover ML models, datasets, papers, and Spaces on the Hugging Face Hub. Run ML tasks via MCP-enabled Spaces.",
    icon: SiHuggingface,
    suggestedActions: [
        "Find the top 10 trending text-generation models",
        "Search for papers about vision transformers",
        "What datasets are available for sentiment analysis?",
        "Discover available ML tasks on Hugging Face Spaces"
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
