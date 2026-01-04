import { AgentConfig } from "../agentConfig";
import { MdPalette } from "react-icons/md";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { frontendAgentSystemPrompt } from "./prompt";

const frontendAgentUserMetadata: AgentUserMetadata = {
    id: "frontend-agent",
    name: "Frontend Agent",
    short_description: "UI customization via natural language",
    long_description: "Customize the application's appearance including themes, colors, fonts, and styling through natural language commands.",
    icon: MdPalette,
    suggestedActions: [
        "Switch to dark mode",
        "Change the primary color to purple",
        "Make the text larger",
        "Reset all styles to default"
    ],
};

const frontendAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.0-flash-lite", // Lighter model - sufficient for simple tool routing
    systemInstruction: frontendAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY || "",
};

export const FrontendAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: frontendAgentUserMetadata,
    implementation_metadata: frontendAgentImplementationMetadata,
};
