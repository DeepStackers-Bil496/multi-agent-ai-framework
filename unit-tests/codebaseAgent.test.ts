import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for lib/agents/codebaseAgent/tools.ts
 *
 * Uses vi.doMock (not vi.mock) because vi.mock is hoisted to the top of the
 * file at compile time and therefore runs BEFORE vi.resetModules() in
 * beforeEach. vi.doMock is not hoisted, so it registers the mock after
 * resetModules clears the module registry, ensuring a fresh mock is used on
 * every import.
 */

const MOCK_RESULTS = [
  {
    filePath: "lib/agents/baseAgent.ts",
    chunkType: "function",
    chunkName: "buildAgentGraph",
    parentClass: "BaseAgent",
    content:
      "protected buildAgentGraph() { return new StateGraph(MessagesAnnotation); }",
    startLine: 89,
    endLine: 105,
    distance: 0.12,
  },
];

describe("CodebaseAgent Tools", () => {
  let mod: typeof import("@/lib/agents/codebaseAgent/tools");

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/codebaseAgent/vectorSearch", () => ({
      searchCodebase: vi.fn().mockResolvedValue(MOCK_RESULTS),
    }));
    mod = await import("@/lib/agents/codebaseAgent/tools");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- createCodebaseAgentTools() ---

  it("createCodebaseAgentTools() returns a non-empty array", () => {
    const tools = mod.createCodebaseAgentTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("every tool has a non-empty name and description", () => {
    const tools = mod.createCodebaseAgentTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  // --- searchCodebaseTool singleton identity ---

  it("searchCodebaseTool is defined and has name 'search_codebase'", () => {
    expect(mod.searchCodebaseTool).toBeDefined();
    expect(mod.searchCodebaseTool.name).toBe("search_codebase");
  });

  // --- Invocation tests ---

  it("search_codebase invoke returns a non-empty string", async () => {
    const tool = mod.createCodebaseAgentTools()[0];
    const result = await tool.invoke({ query: "how is the agent graph built" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("search_codebase invoke result contains the mocked file path", async () => {
    const tool = mod.createCodebaseAgentTools()[0];
    const result = await tool.invoke({ query: "StateGraph construction" });
    expect(result).toContain("lib/agents/baseAgent.ts");
  });

  it("search_codebase invoke with filePathPrefix returns a string", async () => {
    const tool = mod.createCodebaseAgentTools()[0];
    const result = await tool.invoke({
      query: "agent tools",
      filePathPrefix: "lib/agents/",
    });
    expect(typeof result).toBe("string");
  });

  it("search_codebase invoke with limit returns a string", async () => {
    const tool = mod.createCodebaseAgentTools()[0];
    const result = await tool.invoke({ query: "middleware", limit: 3 });
    expect(typeof result).toBe("string");
  });

  it("search_codebase returns a message when no results are found", async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/codebaseAgent/vectorSearch", () => ({
      searchCodebase: vi.fn().mockResolvedValue([]),
    }));
    const freshMod = await import("@/lib/agents/codebaseAgent/tools");
    const tool = freshMod.createCodebaseAgentTools()[0];
    const result = await tool.invoke({ query: "nonexistent thing" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("search_codebase returns a string when vectorSearch throws", async () => {
    vi.resetModules();
    vi.doMock("@/lib/agents/codebaseAgent/vectorSearch", () => ({
      searchCodebase: vi.fn().mockRejectedValue(new Error("DB connection failed")),
    }));
    const freshMod = await import("@/lib/agents/codebaseAgent/tools");
    const tool = freshMod.createCodebaseAgentTools()[0];
    const result = await tool.invoke({ query: "auth middleware" });
    expect(typeof result).toBe("string");
  });
});
