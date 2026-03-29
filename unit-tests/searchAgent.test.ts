import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for lib/agents/searchAgent/tools.ts
 *
 * Real exports:
 *   createWebSearchTool()         — DuckDuckGo web search
 *   createNewsSearchTool()        — news search
 *   createAcademicSearchTool()    — arXiv academic search
 *   createFetchUrlTool()          — fetch a URL's content
 *   createScrapeTextTool()        — scrape text from a page
 *   createExtractLinksTool()      — extract links from a page
 *   createExtractMetadataTool()   — extract page metadata
 *   createAllSearchAgentTools()   — returns all tools above as array
 *
 * We mock duck-duck-scrape and global fetch so no real HTTP calls are made.
 */

vi.mock("duck-duck-scrape", () => ({
  search: vi.fn().mockResolvedValue({
    results: [
      {
        title: "Test Result",
        url: "https://example.com",
        description: "A test search result description",
      },
    ],
    noResults: false,
  }),
  SafeSearchType: { STRICT: "STRICT", MODERATE: "MODERATE", OFF: "OFF" },
}));

const mockHtml = `<html><head><title>Test</title></head><body><p>Hello world</p><a href="https://example.com">Link</a></body></html>`;

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(mockHtml),
    json: vi.fn().mockResolvedValue({}),
  })
);

describe("SearchAgent Tools", () => {
  let mod: typeof import("@/lib/agents/searchAgent/tools");

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("duck-duck-scrape", () => ({
      search: vi.fn().mockResolvedValue({
        results: [{ title: "Test Result", url: "https://example.com", description: "desc" }],
        noResults: false,
      }),
      SafeSearchType: { STRICT: "STRICT", MODERATE: "MODERATE", OFF: "OFF" },
    }));
    mod = await import("@/lib/agents/searchAgent/tools");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("createAllSearchAgentTools() returns a non-empty array of tools", () => {
    const tools = mod.createAllSearchAgentTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("every tool has a non-empty name and description", () => {
    const tools = mod.createAllSearchAgentTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("createWebSearchTool() returns a single DynamicStructuredTool", () => {
    const tool = mod.createWebSearchTool();
    expect(tool).toBeDefined();
    expect(typeof tool.name).toBe("string");
  });

  it("createWebSearchTool invoke returns a string", async () => {
    const tool = mod.createWebSearchTool();
    const result = await tool.invoke({ query: "vitest testing" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("createNewsSearchTool() returns a tool with a name", () => {
    const tool = mod.createNewsSearchTool();
    expect(typeof tool.name).toBe("string");
  });

  it("createFetchUrlTool invoke returns a string", async () => {
    const tool = mod.createFetchUrlTool();
    const result = await tool.invoke({ url: "https://example.com" });
    expect(typeof result).toBe("string");
  });

  it("createScrapeTextTool invoke returns a string", async () => {
    const tool = mod.createScrapeTextTool();
    const result = await tool.invoke({ url: "https://example.com" });
    expect(typeof result).toBe("string");
  });

  it("createExtractLinksTool invoke returns a string", async () => {
    const tool = mod.createExtractLinksTool();
    const result = await tool.invoke({ url: "https://example.com" });
    expect(typeof result).toBe("string");
  });

  it("createWebSearchTool handles search errors and returns a string", async () => {
    vi.mock("duck-duck-scrape", () => ({
      search: vi.fn().mockRejectedValue(new Error("Network failure")),
      SafeSearchType: { STRICT: "STRICT", MODERATE: "MODERATE", OFF: "OFF" },
    }));
    const freshMod = await import("@/lib/agents/searchAgent/tools");
    const tool = freshMod.createWebSearchTool();
    const result = await tool.invoke({ query: "test" });
    expect(typeof result).toBe("string");
  });
});
