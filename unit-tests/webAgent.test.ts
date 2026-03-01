import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/agents/visionAgent/tools.ts
 *
 * Real exports:
 *   createAnalyzeImageTool(runtimeSecrets?)    — analyzes an image via Google GenAI
 *   createGenerateImageTool(runtimeSecrets?)   — generates an image
 *   createAllVisionAgentTools(runtimeSecrets?) — returns all tools as array
 */

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(function () {
    return {
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: vi.fn().mockReturnValue("This image shows a test diagram with boxes and arrows."),
          },
        }),
      }),
    };
  }),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: vi.fn().mockResolvedValue({ text: "A generated image description." }),
        generateImages: vi.fn().mockResolvedValue({
          generatedImages: [{ image: { imageBytes: "base64data" } }],
        }),
      },
    };
  }),
}));

describe("VisionAgent Tools", () => {
  let mod: typeof import("@/lib/agents/visionAgent/tools");

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("@google/generative-ai", () => ({
      GoogleGenerativeAI: vi.fn().mockImplementation(function () {
        return {
          getGenerativeModel: vi.fn().mockReturnValue({
            generateContent: vi.fn().mockResolvedValue({
              response: { text: vi.fn().mockReturnValue("Test analysis result.") },
            }),
          }),
        };
      }),
    }));
    vi.mock("@google/genai", () => ({
      GoogleGenAI: vi.fn().mockImplementation(function () {
        return {
          models: {
            generateContent: vi.fn().mockResolvedValue({ text: "Test." }),
            generateImages: vi.fn().mockResolvedValue({
              generatedImages: [{ image: { imageBytes: "base64data" } }],
            }),
          },
        };
      }),
    }));
    mod = await import("@/lib/agents/visionAgent/tools");
  });

  it("createAllVisionAgentTools() returns a non-empty array", () => {
    const tools = mod.createAllVisionAgentTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("every tool has a non-empty name and description", () => {
    const tools = mod.createAllVisionAgentTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("createAnalyzeImageTool() returns a single tool with a name", () => {
    const tool = mod.createAnalyzeImageTool();
    expect(tool).toBeDefined();
    expect(typeof tool.name).toBe("string");
  });

  it("createAnalyzeImageTool invoke returns a non-empty string", async () => {
    const tool = mod.createAnalyzeImageTool();
    const result = await tool.invoke({
      imageUrl: "https://example.com/test.png",
      prompt: "What is in this image?",
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("createGenerateImageTool() returns a tool with a name", () => {
    const tool = mod.createGenerateImageTool();
    expect(typeof tool.name).toBe("string");
    expect(tool.name.length).toBeGreaterThan(0);
  });

  it("createAllVisionAgentTools() with runtimeSecrets still returns tools", () => {
    const tools = mod.createAllVisionAgentTools({ GEMINI_API_KEY: "test-key" });
    expect(tools.length).toBeGreaterThan(0);
  });
});
