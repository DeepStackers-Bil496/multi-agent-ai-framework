import { describe, expect, it } from "vitest";
import { chatModels } from "@/lib/ai/models";
import { CodingAgentConfig } from "@/lib/agents/codingAgent/config";
import { codingAgentSystemPrompt } from "@/lib/agents/codingAgent/prompt";
import { createCodingAgentTools } from "@/lib/agents/codingAgent/tools";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";

const CODING_AGENT_ID = "coding-agent";

describe("Coding Agent", () => {
  it("uses Ollama glm-4.7-flash by default", () => {
    expect(CodingAgentConfig.implementation_metadata.provider).toBe("ollama");
    expect(CodingAgentConfig.implementation_metadata.modelID).toBe(
      "glm-4.7-flash"
    );
  });

  it("prompt is Python-first", () => {
    expect(codingAgentSystemPrompt).toMatch(/Python/i);
  });

  it("is registered in metadata and chat models", () => {
    const inMetadata = agentUserMetadataList.some(
      (agent) => agent.id === CODING_AGENT_ID
    );
    const inChatModels = chatModels.some(
      (model) => model.id === CODING_AGENT_ID
    );

    expect(inMetadata).toBe(true);
    expect(inChatModels).toBe(true);
  });

  it("exposes codebase search tooling", () => {
    const tools = createCodingAgentTools();
    const toolNames = tools.map((tool) => tool.name);

    expect(toolNames).toContain("search_codebase");
  });
});
