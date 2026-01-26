import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DataAnalystAgentConfig } from "../../lib/agents/dataAnalystAgent/config";
import { dataAnalystAgentSystemPrompt } from "../../lib/agents/dataAnalystAgent/prompt";
import { agentUserMetadataList } from "../../lib/agents/user_metadata";
import { chatModels } from "../../lib/ai/models";
import { createDataAnalystAgentTools } from "../../lib/agents/dataAnalystAgent/tools";

const DATA_ANALYST_AGENT_ID = "data-analyst-agent";

describe("Data Analyst Agent", () => {
  it("uses Google gemini-1.5-flash by default", () => {
    assert.equal(DataAnalystAgentConfig.implementation_metadata.provider, "google");
    assert.equal(DataAnalystAgentConfig.implementation_metadata.modelID, "gemini-1.5-flash");
  });

  it("prompt covers data analysis and visualization", () => {
    assert.match(dataAnalystAgentSystemPrompt, /data analyst/i);
    assert.match(dataAnalystAgentSystemPrompt, /visualization/i);
    assert.match(dataAnalystAgentSystemPrompt, /cleaning/i);
  });

  it("is registered in metadata and chat models", () => {
    const inMetadata = agentUserMetadataList.some((agent) => agent.id === DATA_ANALYST_AGENT_ID);
    const inChatModels = chatModels.some((model) => model.id === DATA_ANALYST_AGENT_ID);
    assert.ok(inMetadata, "agentUserMetadataList should include data-analyst-agent");
    assert.ok(inChatModels, "chatModels should include data-analyst-agent");
  });

  it("exposes codebase search tooling", () => {
    const tools = createDataAnalystAgentTools();
    const toolNames = tools.map((tool) => tool.name);
    assert.ok(toolNames.includes("search_codebase"));
  });
});
