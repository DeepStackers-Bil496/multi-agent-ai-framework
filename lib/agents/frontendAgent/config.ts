import { AgentConfig } from "../agentConfig";
import { MdPalette } from "react-icons/md";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { frontendAgentSystemPrompt } from "./prompt";

const frontendAgentUserMetadata: AgentUserMetadata = {
    id: "frontend-agent",
    name: "Frontend Agent",
    short_description: "UI customization via natural language",
    long_description: "Customize the application's appearance including themes, colors, fonts, effects, gradients, and styling through natural language commands.",
    icon: MdPalette,
    suggestedActions: [
        "Apply the cyberpunk theme",
        "Enable glassmorphism with strong blur",
        "Set a purple to blue gradient background",
        "Make everything more rounded with dramatic shadows",
        "Switch to dark mode with neon pink accent",
        "Use a playful font and bouncy animations",
        "Apply ocean theme preset",
        "Reset all styles to default"
    ],
};

const frontendAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash", // Lighter model - sufficient for simple tool routing
    systemInstruction: frontendAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY || "",
};

export const FrontendAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: frontendAgentUserMetadata,
    implementation_metadata: frontendAgentImplementationMetadata,
};
