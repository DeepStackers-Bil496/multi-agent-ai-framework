import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { WebAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllWebAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";

class WebAgent extends BaseAgent<LLMImplMetadata> {

    constructor(webAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(webAgentConfig, agentTools);
    }
}

export const webAgent = new WebAgent(WebAgentConfig, createAllWebAgentTools());
