import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { GoogleWorkspaceAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";
import { MessagesAnnotation } from "@langchain/langgraph";
import { SystemMessage } from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createLLM } from "../llmFactory";
import { AIMessage } from "@langchain/core/messages";
import { START, StateGraph } from "@langchain/langgraph";
import { createAllGoogleWorkspaceAgentTools } from "./tools";

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

    /**
     * Override agentNode to inject current date into system prompt
     */
    protected async agentNode(state: typeof MessagesAnnotation.State) {
        const { messages } = state;
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
        });

        const systemInstructionWithDate = `Today is ${dateStr}.\n\n${this.implementationMetadata.systemInstruction}`;

        const messagesToSend = [new SystemMessage(systemInstructionWithDate), ...messages];

        try {
            console.log(`[${this.name}] Invoking LLM with date awareness: ${dateStr}`);
            const response = await this.agentLLM!.invoke(messagesToSend);
            return { messages: [response] };
        } catch (error) {
            console.error(`[${this.name}] Error in agentNode:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return {
                messages: [new AIMessage(`Error: ${errorMessage}`)],
            };
        }
    }

    /**
     * Override createRuntimeGraph to inject current date into system prompt
     */
    public createRuntimeGraph(
        runtimeConfig?: Partial<LLMImplMetadata>,
        runtimeSecrets?: Record<string, string>
    ): Runnable {
        const mergedConfig: LLMImplMetadata = {
            ...(this.implementationMetadata as LLMImplMetadata),
            ...runtimeConfig,
            systemInstruction: (this.implementationMetadata as LLMImplMetadata).systemInstruction,
        };

        const secrets = runtimeSecrets || this.runtimeSecrets;
        const runtimeTools = this.createTools(secrets);
        const runtimeLLM = createLLM(mergedConfig);
        const boundLLM = runtimeLLM.bindTools!(runtimeTools);
        const toolNode = new ToolNode(runtimeTools);

        const runtimeAgentNodeWithDate = async (state: typeof MessagesAnnotation.State) => {
            const { messages } = state;
            const now = new Date();
            const dateStr = now.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
            });

            const systemInstructionWithDate = `Today is ${dateStr}.\n\n${mergedConfig.systemInstruction}`;

            const messagesToSend = [new SystemMessage(systemInstructionWithDate), ...messages];

            try {
                console.log(`[${this.name}] (Runtime) Invoking LLM with date awareness: ${dateStr}`);
                const response = await boundLLM.invoke(messagesToSend);
                return { messages: [response] };
            } catch (error) {
                console.error(`[${this.name}] (Runtime) Error in agentNode:`, error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                return { messages: [new AIMessage(`Error: ${errorMessage}`)] };
            }
        };

        return new StateGraph(MessagesAnnotation)
            .addNode("agentNode", runtimeAgentNodeWithDate)
            .addNode("tools", toolNode)
            .addEdge(START, "agentNode")
            .addConditionalEdges("agentNode", this.agentRoute.bind(this))
            .addEdge("tools", "agentNode")
            .compile();
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
