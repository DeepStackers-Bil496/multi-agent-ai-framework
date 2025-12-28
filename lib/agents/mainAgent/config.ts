import { AgentConfig } from "../agentConfig";
import { FiCpu } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { APILLMImplMetadata, AgentUserMetadata } from "../../types";


const mainAgentUserMetadata: AgentUserMetadata = {
    id: "main-agent",
    name: "Main Agent",
    short_description: "Main Agent that is used as orchestrator.",
    long_description: "Main Agent that handles the conversation.",
    icon: FiCpu,
    suggestedActions: [
        "What are the advantages of using Next.js?",
        "Who found the DeepStackers AI Studio?",
        "What is Mustafa Kemal Atatürk?",
        "What is Model Context Protocol"
    ],
}

const mainAgentImplementationMetadata: APILLMImplMetadata = {
    type: API_MODEL_TYPE,
    modelID: "gemini-2.5-flash",
    systemInstruction: "You are a helpful assistant.",
    apiKey: process.env.GEMINI_API_KEY || ""
}

export const MainAgentConfig: AgentConfig<APILLMImplMetadata> = {
    user_metadata: mainAgentUserMetadata,
    implementation_metadata: mainAgentImplementationMetadata,
}

