import { afterEach, describe, expect, it, vi } from "vitest";

const {
  mockInvoke,
  mockGenerateContent,
  mockGenerateImages,
  mockPut,
  mockTextToImage,
} = vi.hoisted(() => ({
  mockInvoke: vi
    .fn()
    .mockResolvedValue("This image shows a test diagram with boxes and arrows."),
  mockGenerateContent: vi
    .fn()
    .mockResolvedValue({ text: "A generated image description." }),
  mockGenerateImages: vi.fn().mockResolvedValue({
    generatedImages: [{ image: { imageBytes: "base64data" } }],
  }),
  mockPut: vi.fn().mockResolvedValue({ url: "https://example.com/generated.png" }),
  mockTextToImage: vi.fn().mockResolvedValue({
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  }),
}));

vi.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: vi.fn().mockImplementation(function MockChatGoogle() {
    return {
      invoke: mockInvoke,
    };
  }),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function MockGoogleGenAI() {
    return {
      models: {
        generateContent: mockGenerateContent,
        generateImages: mockGenerateImages,
      },
    };
  }),
}));

vi.mock("@vercel/blob", () => ({
  put: mockPut,
}));

vi.mock("@huggingface/inference", () => ({
  InferenceClient: vi.fn().mockImplementation(function MockInferenceClient() {
    return {
      textToImage: mockTextToImage,
    };
  }),
}));

import * as mod from "@/lib/agents/visionAgent/tools";

describe("VisionAgent Tools", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GEMINI_API_KEY;
    delete process.env.HF_TOKEN;

    mockInvoke.mockResolvedValue(
      "This image shows a test diagram with boxes and arrows."
    );
    mockGenerateContent.mockResolvedValue({
      text: "A generated image description.",
    });
    mockGenerateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: "base64data" } }],
    });
    mockPut.mockResolvedValue({ url: "https://example.com/generated.png" });
    mockTextToImage.mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
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
