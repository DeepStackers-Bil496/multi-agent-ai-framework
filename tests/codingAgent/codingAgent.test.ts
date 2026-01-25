import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CodingAgentConfig } from "@/lib/agents/codingAgent/config";
import { codingAgentSystemPrompt } from "@/lib/agents/codingAgent/prompt";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import { chatModels } from "@/lib/ai/models";
import { createCodingAgentTools } from "@/lib/agents/codingAgent/tools";

const CODING_AGENT_ID = "coding-agent";

describe("Coding Agent", () => {
  it("uses Ollama glm-4.7-flash by default", () => {
    assert.equal(CodingAgentConfig.implementation_metadata.provider, "ollama");
    assert.equal(CodingAgentConfig.implementation_metadata.modelID, "glm-4.7-flash");
  });

  it("prompt is Python-first", () => {
    assert.match(codingAgentSystemPrompt, /Python/i);
  });

  it("is registered in metadata and chat models", () => {
    const inMetadata = agentUserMetadataList.some((agent) => agent.id === CODING_AGENT_ID);
    const inChatModels = chatModels.some((model) => model.id === CODING_AGENT_ID);
    assert.ok(inMetadata, "agentUserMetadataList should include coding-agent");
    assert.ok(inChatModels, "chatModels should include coding-agent");
  });

  it("exposes codebase search tooling", () => {
    const tools = createCodingAgentTools();
    const toolNames = tools.map((tool) => tool.name);
    assert.ok(toolNames.includes("search_codebase"));
  });
});
