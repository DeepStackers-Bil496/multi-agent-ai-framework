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
        "Send an email to alice@example.com about the project update",
        "Create a meeting tomorrow at 2pm with bob@example.com",
        "List my recent files in Google Drive",
        "Create a new Google Doc titled 'Meeting Notes'",
        "Add a row to my Budget spreadsheet with Q1 expenses",
        "Find a 30-minute free slot tomorrow afternoon",
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
