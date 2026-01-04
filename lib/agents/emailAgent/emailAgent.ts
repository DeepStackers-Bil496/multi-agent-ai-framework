import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { EmailAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllEmailAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class EmailAgent extends BaseAgent<LLMImplMetadata> {
    constructor(emailAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(emailAgentConfig, agentTools);
    }
}

export const emailAgent = new EmailAgent(EmailAgentConfig, createAllEmailAgentTools());

// Self-register with the agent registry
agentRegistry.register({
    id: emailAgent.id,
    name: emailAgent.name,
    toolName: "delegate_to_email",
    toolDescription: `Route the task to the Email Agent for drafting or sending emails.
Use this when the user asks to:
- Draft an email (subject/body)
- Manage recipients (to/cc/bcc)
- Adjust tone or format of an email
- Send an email after confirmation`,
    taskPrefix: "[Email Task]",
    instance: emailAgent,
    getCompiledGraph: () => emailAgent.getCompiledGraph(),
});


