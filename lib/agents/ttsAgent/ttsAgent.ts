import type { LLMImplMetadata } from "@/lib/types";
import { AgentConfig } from "../agentConfig";
import { BaseAgent } from "../baseAgent";
import { agentRegistry } from "../agentRegistry";
import { TtsAgentConfig } from "./config";
import { createTtsAgentTools } from "./tools";
import { DynamicStructuredTool } from "@langchain/core/tools";

class TtsAgent extends BaseAgent<LLMImplMetadata> {
  constructor(
    ttsAgentConfig: AgentConfig<LLMImplMetadata>,
    agentTools: DynamicStructuredTool[]
  ) {
    super(ttsAgentConfig, agentTools);
  }

  protected createTools(
    _runtimeSecrets?: Record<string, string>
  ): DynamicStructuredTool[] {
    return createTtsAgentTools();
  }
}

export const ttsAgent = new TtsAgent(
  TtsAgentConfig,
  createTtsAgentTools()
);

agentRegistry.register({
  id: ttsAgent.id,
  name: ttsAgent.name,
  toolName: "delegate_to_tts",
  toolDescription: `Route here only when the user explicitly asks for a spoken response.
This agent generates short, TTS-friendly Turkish text.`,
  taskPrefix: "[TTS Task]",
  instance: ttsAgent,
  getCompiledGraph: () => ttsAgent.getCompiledGraph(),
});
