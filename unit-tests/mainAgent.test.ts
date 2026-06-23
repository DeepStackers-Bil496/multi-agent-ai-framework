import { describe, it, expect } from "vitest";
import { MainAgentConfig } from "@/lib/agents/mainAgent/config";
import { mainAgentSystemPrompt } from "@/lib/agents/mainAgent/prompt";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import { chatModels } from "@/lib/ai/models";

const MAIN_AGENT_ID = "main-agent";

describe("MainAgent", () => {
  it("uses Google gemini-2.5-flash by default", () => {
    expect(MainAgentConfig.implementation_metadata.provider).toBe("google");
    expect(MainAgentConfig.implementation_metadata.modelID).toBe(
      "gemini-2.5-flash"
    );
  });

  it("is registered in metadata and chat models", () => {
    expect(
      agentUserMetadataList.some((agent) => agent.id === MAIN_AGENT_ID)
    ).toBe(true);
    expect(chatModels.some((model) => model.id === MAIN_AGENT_ID)).toBe(true);
  });

  it("prompt includes delegation coverage for every active sub-agent", () => {
    const expectedDelegations = [
      "delegate_to_github",
      "delegate_to_codebase",
      "delegate_to_frontend",
      "delegate_to_huggingface",
      "delegate_to_google_workspace",
      "delegate_to_search",
      "delegate_to_coding",
      "delegate_to_data_analyst",
      "delegate_to_vision",
    ];

    for (const delegationTool of expectedDelegations) {
      expect(mainAgentSystemPrompt).toContain(delegationTool);
    }
  });

  it("prompt still allows direct answers for general questions", () => {
    expect(mainAgentSystemPrompt).toMatch(/answer directly/i);
    expect(mainAgentSystemPrompt).toMatch(/general[-\s]knowledge/i);
  });

  it("suggested actions cover repository and research tasks", () => {
    const actions = MainAgentConfig.user_metadata.suggestedActions ?? [];

    expect(actions.length).toBeGreaterThanOrEqual(4);
    expect(actions.some((action) => /commits/i.test(action))).toBe(true);
    expect(
      actions.some((action) => /hugging face|arxiv/i.test(action))
    ).toBe(true);
  });
});
