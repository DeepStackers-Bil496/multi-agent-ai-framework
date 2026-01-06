import { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { DocumentAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createAllDocumentAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class DocumentAgent extends BaseAgent<LLMImplMetadata> {
    constructor(documentAgentConfig: AgentConfig<LLMImplMetadata>, agentTools: DynamicStructuredTool[]) {
        super(documentAgentConfig, agentTools);
    }
}

export const documentAgent = new DocumentAgent(DocumentAgentConfig, createAllDocumentAgentTools());

agentRegistry.register({
    id: documentAgent.id,
    name: documentAgent.name,
    toolName: "delegate_to_document",
    toolDescription: `Route document summarization, extraction, and formatting tasks here.
Use this when the user asks to:
- Summarize documents or transcripts
- Extract key points from text
- Generate structured reports
- Search across document collections
- Convert between markdown/plaintext`,
    taskPrefix: "[Document Task]",
    instance: documentAgent,
    getCompiledGraph: () => documentAgent.getCompiledGraph(),
});
