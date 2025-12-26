import { AgentConfig } from "../agentConfig";
import { FiCpu } from "react-icons/fi";
import { API_MODEL_TYPE } from "../../constants";
import { APILLMImpl } from "../../types";

export const MainAgentConfig: AgentConfig<APILLMImpl> = {
    metadata: {
        id: "main-agent",
        name: "Main Agent",
        description: "Main Agent",
        icon: FiCpu,
    },
    implementation: {
        type: API_MODEL_TYPE,
        modelID: "gemini-flash-latest",
        systemInstruction: "You are a helpful assistant.",
        apiKey: process.env.GEMINI_API_KEY || ""
    }
}