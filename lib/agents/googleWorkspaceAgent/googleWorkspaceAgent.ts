import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { GoogleWorkspaceAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllGoogleWorkspaceAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class GoogleWorkspaceAgent extends BaseAgent<LLMImplMetadata> {
    constructor(
        googleWorkspaceAgentConfig: AgentConfig<LLMImplMetadata>,
        agentTools: DynamicStructuredTool[]
    ) {
        super(googleWorkspaceAgentConfig, agentTools);
    }

    /**
     * Create Google Workspace tools, passing runtime secrets when available
     */
    protected createTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
        return createAllGoogleWorkspaceAgentTools(runtimeSecrets);
    }
}

export const googleWorkspaceAgent = new GoogleWorkspaceAgent(
    GoogleWorkspaceAgentConfig,
    createAllGoogleWorkspaceAgentTools()
);

// Self-register with the agent registry
agentRegistry.register({
    id: googleWorkspaceAgent.id,
    name: googleWorkspaceAgent.name,
    toolName: "delegate_to_google_workspace",
    toolDescription: `Route Google Workspace tasks here.
Use this when the user asks to:
- Send, draft, search, read, or manage emails (Gmail)
- Create, update, delete, or list calendar events (Calendar)
- Find available time slots for meetings (Calendar)
- List, search, upload, download, or share files (Drive)
- Create, read, or edit Google Docs (Docs)
- Create, read, update, or append data to spreadsheets (Sheets)
- Create or view presentations (Slides)

This agent handles all Google Workspace services in one place.`,
    taskPrefix: "[Google Workspace Task]",
    instance: googleWorkspaceAgent,
    getCompiledGraph: () => googleWorkspaceAgent.getCompiledGraph(),
});
