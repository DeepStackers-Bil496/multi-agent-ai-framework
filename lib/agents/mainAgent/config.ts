import { AgentConfig } from "../agentConfig";
import { FiCpu } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { mainAgentSystemPrompt } from "./prompt";

const mainAgentUserMetadata: AgentUserMetadata = {
    id: "main-agent",
    name: "Main Agent",
    short_description: "Main Agent that is used as orchestrator.",
    long_description: "Main Agent that handles the conversation.",
    icon: FiCpu,
    suggestedActions: [
        "Search this link oruccakir.live",
        "Get the last two commits from Evangeline repo owner is oruccakir",
        "What is Mustafa Kemal Atatürk?",
        "What is Model Context Protocol"
    ],
}

const mainAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: mainAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY || ""
}

export const MainAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: mainAgentUserMetadata,
    implementation_metadata: mainAgentImplementationMetadata,
}
