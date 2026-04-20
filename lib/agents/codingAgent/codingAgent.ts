import type { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { CodingAgentConfig } from "./config";
import { BaseAgent } from "../baseAgent";
import { createCodingAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { agentRegistry } from "../agentRegistry";

class CodingAgent extends BaseAgent<LLMImplMetadata> {
  constructor(
    codingAgentConfig: AgentConfig<LLMImplMetadata>,
    agentTools: DynamicStructuredTool[]
  ) {
    super(codingAgentConfig, agentTools);
  }

  protected createTools(
    runtimeSecrets?: Record<string, string>
  ): DynamicStructuredTool[] {
    return createCodingAgentTools(runtimeSecrets);
  }
}

export const codingAgent = new CodingAgent(
  CodingAgentConfig,
  createCodingAgentTools()
);

agentRegistry.register({
  id: codingAgent.id,
  name: codingAgent.name,
  toolName: "delegate_to_coding",
  toolDescription: `Route coding and implementation tasks here.
Use this when the user asks to:
- Implement algorithms or data structures
- Write or refactor code in any language
- Generate tests, examples, or quick scripts
- Provide code-level explanations and best practices`,
  taskPrefix: "[Coding Task]",
  instance: codingAgent,
  getCompiledGraph: () => codingAgent.getCompiledGraph(),
});
