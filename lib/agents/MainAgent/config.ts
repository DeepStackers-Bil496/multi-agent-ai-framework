import { AgentConfig } from "../agent";
import {
    FiCpu
} from "react-icons/fi";

export const MainAgentConfig: AgentConfig = {
    id: "main-agent",
    name: "Main Agent",
    description: "Main Agent",
    icon: FiCpu,
    modelID: "",
    systemInstruction: "",
    sampleUsage: "",
    sampleDialogue: []
}