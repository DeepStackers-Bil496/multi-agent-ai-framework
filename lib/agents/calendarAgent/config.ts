import { AgentConfig } from "../agentConfig";
import { MdOutlineCalendarToday } from "react-icons/md";
import { API_MODEL_TYPE } from "../../constants";
import { LLMImplMetadata, AgentUserMetadata } from "../../types";
import { calendarAgentSystemPrompt } from "./prompt";

const calendarAgentUserMetadata: AgentUserMetadata = {
    id: "calendar-agent",
    name: "Calendar Agent",
    short_description: "Manage Google Calendar events and scheduling",
    long_description: "Create, update, list, and delete calendar events and find free slots using Google Calendar.",
    icon: MdOutlineCalendarToday,
    suggestedActions: [
        "Create a meeting on Tuesday at 2pm with alice@example.com.",
        "List my next 5 events for this week.",
        "Find a 30-minute free slot tomorrow afternoon."
    ],
};

const calendarAgentImplementationMetadata: LLMImplMetadata = {
    type: API_MODEL_TYPE,
    provider: "google",
    modelID: "gemini-2.5-flash",
    systemInstruction: calendarAgentSystemPrompt,
    apiKey: process.env.GEMINI_API_KEY || "",
};

export const CalendarAgentConfig: AgentConfig<LLMImplMetadata> = {
    user_metadata: calendarAgentUserMetadata,
    implementation_metadata: calendarAgentImplementationMetadata,
};
