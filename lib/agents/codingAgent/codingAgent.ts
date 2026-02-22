import type { DynamicStructuredTool } from "@langchain/core/tools";
import type { LLMImplMetadata } from "@/lib/types";
import type { AgentConfig } from "../agentConfig";
import { agentRegistry } from "../agentRegistry";
import { BaseAgent } from "../baseAgent";
import { CodingAgentConfig } from "./config";
import { createCodingAgentTools } from "./tools";

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
  toolDescription: `Route coding and hands-on repository tasks here.
Use this when the user asks to:
- Work with a GitHub repository (browse, read, edit files)
- Clone a repo, run commands, install packages, or run tests
- Create branches, commits, or pull requests
- Implement features, fix bugs, or refactor code in a repository
- Write a CLAUDE.md or explain codebase architecture
- Review recent changes or find issues in code`,
  taskPrefix: "[Coding Task]",
  instance: codingAgent,
  getCompiledGraph: () => codingAgent.getCompiledGraph(),
});
