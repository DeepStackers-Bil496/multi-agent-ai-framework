import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { EmailAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllEmailAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";

class EmailAgent extends BaseAgent<LLMImplMetadata> {
    constructor(emailAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(emailAgentConfig, agentTools);
    }
}

export const emailAgent = new EmailAgent(EmailAgentConfig, createAllEmailAgentTools());
