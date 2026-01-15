import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { FrontendAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createFrontendAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class FrontendAgent extends BaseAgent<LLMImplMetadata> {
    constructor(frontendAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(frontendAgentConfig, agentTools);
    }

    /**
     * Create Frontend tools - no secrets needed for this agent
     */
    protected createTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
        return createFrontendAgentTools();
    }
}

export const frontendAgent = new FrontendAgent(FrontendAgentConfig, createFrontendAgentTools());

// Self-register with the agent registry
agentRegistry.register({
    id: frontendAgent.id,
    name: frontendAgent.name,
    toolName: "delegate_to_frontend",
    toolDescription: `Route the task to the Frontend Agent for UI customization.
Use this when the user asks to:
- Change theme (light/dark mode)
- Update colors (primary, accent, background)
- Adjust font size (smaller/larger text)
- Modify border radius (rounder/sharper corners)
- Reset styles to defaults`,
    taskPrefix: "[Frontend Task]",
    instance: frontendAgent,
    getCompiledGraph: () => frontendAgent.getCompiledGraph(),
});
