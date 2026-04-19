import { AgentConfig } from "../agentConfig";
import { SiGoogle } from "react-icons/si";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { googleWorkspaceAgentSystemPrompt } from "./prompt";

const googleWorkspaceAgentUserMetadata: AgentUserMetadata = {
    id: "google-workspace-agent",
    name: "Google Workspace Agent",
    short_description: "Manage Gmail, Calendar, Drive, Docs, Sheets, and Slides",
    long_description:
        "A unified agent for all Google Workspace services. Send and manage emails via Gmail, " +
        "schedule meetings and find free time slots with Calendar, organize and share files in Drive, " +
        "create and edit Google Docs, work with spreadsheet data in Sheets, and create presentations in Slides.",
    icon: SiGoogle,
    suggestedActions: [
        "Draft an email to alice@example.com summarizing today's deploy.",
        "Find a 30-minute free slot tomorrow afternoon.",
        "Create a Google Doc titled 'Q2 roadmap' with these bullet points.",
        "Append today's expenses as a row in my Budget sheet.",
        "Share the latest file in Drive with bob@example.com as a commenter.",
        "List my inbox emails from the past 24 hours.",
    ],
};

const googleWorkspaceAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: googleWorkspaceAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY || "",
};

export const GoogleWorkspaceAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: googleWorkspaceAgentUserMetadata,
    implementation_metadata: googleWorkspaceAgentImplementationMetadata,
};
