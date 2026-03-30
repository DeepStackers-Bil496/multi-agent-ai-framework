import { afterEach, describe, expect, it, vi } from "vitest";

const {
  mockSearch,
  mockSearchNews,
  mockExaSearchAndContents,
  mockFetch,
} = vi.hoisted(() => ({
  mockSearch: vi.fn().mockResolvedValue({
    results: [
      {
        title: "Test Result",
        url: "https://example.com",
        description: "A test search result description",
      },
    ],
    noResults: false,
  }),
  mockSearchNews: vi.fn().mockResolvedValue({ results: [] }),
  mockExaSearchAndContents: vi.fn().mockResolvedValue({
    results: [
      {
        title: "Exa Result",
        url: "https://example.com/exa",
        highlights: ["A semantic search result"],
      },
    ],
  }),
  mockFetch: vi.fn(),
}));

vi.mock("duck-duck-scrape", () => ({
  search: mockSearch,
  searchNews: mockSearchNews,
  SafeSearchType: { STRICT: "STRICT", MODERATE: "MODERATE", OFF: "OFF" },
}));

vi.mock("exa-js", () => ({
  default: vi.fn().mockImplementation(function MockExa() {
    return {
      searchAndContents: mockExaSearchAndContents,
    };
  }),
}));

const mockHtml = `<html><head><title>Test</title></head><body><p>Hello world</p><a href="https://example.com">Link</a></body></html>`;

vi.stubGlobal("fetch", mockFetch);
mockFetch.mockResolvedValue({
  ok: true,
  status: 200,
  text: vi.fn().mockResolvedValue(mockHtml),
  json: vi.fn().mockResolvedValue({}),
});

import * as mod from "@/lib/agents/searchAgent/tools";

describe("SearchAgent Tools", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.EXA_API_KEY;

    mockSearch.mockResolvedValue({
      results: [
        {
          title: "Test Result",
          url: "https://example.com",
          description: "A test search result description",
        },
      ],
      noResults: false,
    });
    mockSearchNews.mockResolvedValue({ results: [] });
    mockExaSearchAndContents.mockResolvedValue({
      results: [
        {
          title: "Exa Result",
          url: "https://example.com/exa",
          highlights: ["A semantic search result"],
        },
      ],
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(mockHtml),
      json: vi.fn().mockResolvedValue({}),
    });
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
    mockSearch.mockRejectedValueOnce(new Error("Network failure"));

    const tool = mod.createWebSearchTool();
    const result = await tool.invoke({ query: "test" });
    expect(typeof result).toBe("string");
    expect(result).toContain("Error performing web search");
  });
});
