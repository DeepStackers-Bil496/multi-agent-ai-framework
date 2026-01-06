import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { CalendarAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllCalendarAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class CalendarAgent extends BaseAgent<LLMImplMetadata> {
    constructor(calendarAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(calendarAgentConfig, agentTools);
    }
}

export const calendarAgent = new CalendarAgent(CalendarAgentConfig, createAllCalendarAgentTools());

agentRegistry.register({
    id: calendarAgent.id,
    name: calendarAgent.name,
    toolName: "delegate_to_calendar",
    toolDescription: `Route calendar and scheduling tasks here.
Use this when the user asks to:
- Create, update, or delete calendar events
- List upcoming events
- Find available time slots`,
    taskPrefix: "[Calendar Task]",
    instance: calendarAgent,
    getCompiledGraph: () => calendarAgent.getCompiledGraph(),
});
