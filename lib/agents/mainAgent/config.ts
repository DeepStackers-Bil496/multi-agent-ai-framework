import { AgentConfig } from "../agentConfig";
import { FiCpu } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { APILLMImpl } from "../../types";

export const MainAgentConfig: AgentConfig<APILLMImpl> = {
    user_metadata: {
        id: "main-agent",
        name: "Main Agent",
        short_description: "Main Agent that is used as orchestrator.",
        long_description: "Main Agent that handles the conversation.",
        icon: FiCpu,
    },
    implementation_metadata: {
        type: API_MODEL_TYPE,
        modelID: "gemini-2.5-flash",
        systemInstruction: "You are a helpful assistant.",
        apiKey: process.env.GEMINI_API_KEY || ""
    }
}