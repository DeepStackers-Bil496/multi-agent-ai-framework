import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for lib/agents/huggingFaceAgent/tools.ts
 *
 * Real exports:
 *   createAllHuggingFaceMCPTools(runtimeSecrets?) — returns all 9 MCP-backed tools
 *   Individual factory functions:
 *     createWhoAmITool, createModelSearchTool, createDatasetSearchTool,
 *     createPaperSearchTool, createSpaceSearchTool, createHubRepoDetailsTool,
 *     createDocSearchTool, createDocFetchTool, createDynamicSpaceTool
 *
 * We mock the MCP SDK so no real network connections are made.
 * Tool invocations test the graceful error path: connection fails, tool
 * must return a string instead of throwing.
 */

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(function () {
    return {
      connect: vi.fn().mockRejectedValue(new Error("MCP connection not available in test")),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ result: "mock hf result" }) }],
      }),
    };
  }),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

describe("HuggingFaceAgent Tools", () => {
  let mod: typeof import("@/lib/agents/huggingFaceAgent/tools");

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
      Client: vi.fn().mockImplementation(function () {
        return {
          connect: vi.fn().mockRejectedValue(new Error("MCP connection not available in test")),
          callTool: vi.fn().mockResolvedValue({
            content: [{ type: "text", text: JSON.stringify({ result: "mock hf result" }) }],
          }),
        };
      }),
    }));
    vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
      StreamableHTTPClientTransport: vi.fn().mockImplementation(function () {
        return {};
      }),
    }));
    mod = await import("@/lib/agents/huggingFaceAgent/tools");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- createAllHuggingFaceMCPTools() ---

  it("createAllHuggingFaceMCPTools() returns a non-empty array", () => {
    const tools = mod.createAllHuggingFaceMCPTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("createAllHuggingFaceMCPTools() returns exactly 9 tools", () => {
    const tools = mod.createAllHuggingFaceMCPTools();
    expect(tools.length).toBe(9);
  });

  it("every tool has a non-empty name and description", () => {
    const tools = mod.createAllHuggingFaceMCPTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("createAllHuggingFaceMCPTools() with runtimeSecrets still returns 9 tools", () => {
    const tools = mod.createAllHuggingFaceMCPTools({ HF_TOKEN: "hf_test123" });
    expect(tools.length).toBe(9);
  });

  // --- All expected tool names are present ---

  const expectedToolNames = [
    "hf_whoami",
    "model_search",
    "dataset_search",
    "paper_search",
    "space_search",
    "hub_repo_details",
    "hf_doc_search",
    "hf_doc_fetch",
    "dynamic_space",
  ];

  for (const toolName of expectedToolNames) {
    it(`tool '${toolName}' is present in createAllHuggingFaceMCPTools()`, () => {
      const tools = mod.createAllHuggingFaceMCPTools();
      expect(tools.find((t) => t.name === toolName)).toBeDefined();
    });
  }

  // --- Individual factory functions return tools with correct names ---

  it("createWhoAmITool() returns a tool named 'hf_whoami'", () => {
    expect(mod.createWhoAmITool().name).toBe("hf_whoami");
  });

  it("createModelSearchTool() returns a tool named 'model_search'", () => {
    expect(mod.createModelSearchTool().name).toBe("model_search");
  });

  it("createDatasetSearchTool() returns a tool named 'dataset_search'", () => {
    expect(mod.createDatasetSearchTool().name).toBe("dataset_search");
  });

  it("createPaperSearchTool() returns a tool named 'paper_search'", () => {
    expect(mod.createPaperSearchTool().name).toBe("paper_search");
  });

  it("createSpaceSearchTool() returns a tool named 'space_search'", () => {
    expect(mod.createSpaceSearchTool().name).toBe("space_search");
  });

  it("createHubRepoDetailsTool() returns a tool named 'hub_repo_details'", () => {
    expect(mod.createHubRepoDetailsTool().name).toBe("hub_repo_details");
  });

  it("createDocSearchTool() returns a tool named 'hf_doc_search'", () => {
    expect(mod.createDocSearchTool().name).toBe("hf_doc_search");
  });

  it("createDocFetchTool() returns a tool named 'hf_doc_fetch'", () => {
    expect(mod.createDocFetchTool().name).toBe("hf_doc_fetch");
  });

  it("createDynamicSpaceTool() returns a tool named 'dynamic_space'", () => {
    expect(mod.createDynamicSpaceTool().name).toBe("dynamic_space");
  });

  // --- Invocation error handling: MCP unavailable must return string, not throw ---

  it("hf_whoami invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createWhoAmITool().invoke({});
    expect(typeof result).toBe("string");
  });

  it("model_search invoke with query returns a string when MCP is unavailable", async () => {
    const result = await mod.createModelSearchTool().invoke({ query: "llama language model" });
    expect(typeof result).toBe("string");
  });

  it("model_search invoke without query (trending) returns a string when MCP is unavailable", async () => {
    const result = await mod.createModelSearchTool().invoke({ sort: "downloads" });
    expect(typeof result).toBe("string");
  });

  it("dataset_search invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createDatasetSearchTool().invoke({ query: "image classification dataset" });
    expect(typeof result).toBe("string");
  });

  it("paper_search invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createPaperSearchTool().invoke({ query: "transformer attention mechanism" });
    expect(typeof result).toBe("string");
  });

  it("space_search invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createSpaceSearchTool().invoke({ query: "image generation" });
    expect(typeof result).toBe("string");
  });

  it("hub_repo_details invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createHubRepoDetailsTool().invoke({ repo_ids: ["openai/whisper-large-v3"] });
    expect(typeof result).toBe("string");
  });

  it("hf_doc_search invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createDocSearchTool().invoke({ query: "how to fine-tune a model" });
    expect(typeof result).toBe("string");
  });

  it("hf_doc_fetch invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createDocFetchTool().invoke({
      doc_url: "https://huggingface.co/docs/transformers/index",
    });
    expect(typeof result).toBe("string");
  });

  it("dynamic_space discover invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createDynamicSpaceTool().invoke({ operation: "discover" });
    expect(typeof result).toBe("string");
  });

  it("dynamic_space view_parameters invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createDynamicSpaceTool().invoke({
      operation: "view_parameters",
      space_name: "stabilityai/stable-diffusion",
    });
    expect(typeof result).toBe("string");
  });
});
