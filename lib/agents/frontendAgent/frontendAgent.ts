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
    toolDescription: `Use this for ANY request to change how THIS running app looks or feels — its live UI / appearance. Changes apply instantly to the app the user is currently viewing.
Route here whenever the user mentions:
- theme / dark mode / light mode
- preset themes: cyberpunk, ocean, forest, sunset, midnight, minimal, retro
- colors (primary / accent / background), e.g. "neon pink accent", HSL values
- gradient backgrounds (purple-to-blue, sunset, ocean, aurora, …)
- glassmorphism / frosted-glass effect
- shadows (subtle / dramatic), border radius / rounded corners
- entrance animations (fade / slide / bounce / scale) and animation speed
- font family or font size
- chat message bubble style
- resetting all styles to default
Examples that MUST route here: "make it dark", "apply the cyberpunk preset", "neon purple theme with bouncy animations", "add a purple-to-blue gradient background", "rounder corners and bigger font", "reset the styles".
IMPORTANT: You CAN change this app's appearance through this agent. Never tell the user to open Settings/Preferences or that you cannot modify the UI — just delegate here.`,
    taskPrefix: "[Frontend Task]",
    instance: frontendAgent,
    getCompiledGraph: () => frontendAgent.getCompiledGraph(),
});
