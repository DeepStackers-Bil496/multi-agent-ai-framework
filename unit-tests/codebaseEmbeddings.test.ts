import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type EmbedResult = {
  embeddings?: Array<{ values?: number[] }>;
};

type GoogleGenAIMock = {
  GoogleGenAI: ReturnType<typeof vi.fn>;
  embedContent: ReturnType<typeof vi.fn>;
};

async function loadEmbeddingsModule({
  apiKey = "test-gemini-key",
  embedImplementation,
}: {
  apiKey?: string | undefined;
  embedImplementation?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.resetModules();

  if (apiKey) {
    process.env.GEMINI_API_KEY = apiKey;
  } else {
    delete process.env.GEMINI_API_KEY;
  }

  const embedContent =
    embedImplementation ??
    vi.fn<(...args: unknown[]) => Promise<EmbedResult>>().mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2, 0.3] }],
    });

  const GoogleGenAI = vi
    .fn()
    .mockImplementation(() => ({ models: { embedContent } }));

  vi.doMock("@google/genai", () => ({
    GoogleGenAI,
  }));

  const mod = await import("@/lib/agents/codebaseAgent/embeddings");

  return {
    mod,
    mock: {
      GoogleGenAI,
      embedContent,
    } satisfies GoogleGenAIMock,
  };
}

describe("Codebase embeddings core", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  it("throws when GEMINI_API_KEY is missing", async () => {
    const { mod } = await loadEmbeddingsModule({ apiKey: undefined });

    await expect(mod.getEmbedding("hello")).rejects.toThrow(
      "GEMINI_API_KEY environment variable is required for embeddings"
    );
  });

  it("creates the Google embedding client lazily and reuses it across calls", async () => {
    const { mod, mock } = await loadEmbeddingsModule();

    const first = await mod.getEmbedding("first text");
    const second = await mod.getEmbedding("second text");

    expect(mock.GoogleGenAI).toHaveBeenCalledTimes(1);
    expect(mock.embedContent).toHaveBeenCalledTimes(2);
    expect(first).toEqual([0.1, 0.2, 0.3]);
    expect(second).toEqual([0.1, 0.2, 0.3]);
    expect(mock.embedContent).toHaveBeenNthCalledWith(1, {
      model: "gemini-embedding-001",
      contents: "first text",
      config: {
        outputDimensionality: 768,
      },
    });
  });

  it("retries rate-limited embedding requests and eventually succeeds", async () => {
    vi.useFakeTimers();

    const rateLimitError = Object.assign(new Error("Too many requests"), {
      status: 429,
    });
    const embedContent = vi
      .fn<(...args: unknown[]) => Promise<EmbedResult>>()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        embeddings: [{ values: [0.9, 0.8, 0.7] }],
      });

    const { mod, mock } = await loadEmbeddingsModule({ embedImplementation: embedContent });

    const promise = mod.getEmbedding("retry me");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual([0.9, 0.8, 0.7]);
    expect(mock.embedContent).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-rate-limit embedding failures", async () => {
    const embedContent = vi
      .fn<(...args: unknown[]) => Promise<EmbedResult>>()
      .mockRejectedValue(new Error("service unavailable"));
    const { mod, mock } = await loadEmbeddingsModule({ embedImplementation: embedContent });

    await expect(mod.getEmbedding("fail fast")).rejects.toThrow(
      "service unavailable"
    );
    expect(mock.embedContent).toHaveBeenCalledTimes(1);
  });

  it("returns embeddings for multiple texts in order", async () => {
    const embedContent = vi
      .fn<(...args: unknown[]) => Promise<EmbedResult>>()
      .mockResolvedValueOnce({ embeddings: [{ values: [1] }] })
      .mockResolvedValueOnce({ embeddings: [{ values: [2] }] })
      .mockResolvedValueOnce({ embeddings: [{ values: [3] }] });
    const { mod } = await loadEmbeddingsModule({ embedImplementation: embedContent });

    const result = await mod.getEmbeddings(["a", "b", "c"]);

    expect(result).toEqual([[1], [2], [3]]);
  });

  it("processes batched embeddings without dropping results between batches", async () => {
    vi.useFakeTimers();

    const embedContent = vi
      .fn<(...args: unknown[]) => Promise<EmbedResult>>()
      .mockResolvedValueOnce({ embeddings: [{ values: [10] }] })
      .mockResolvedValueOnce({ embeddings: [{ values: [20] }] })
      .mockResolvedValueOnce({ embeddings: [{ values: [30] }] })
      .mockResolvedValueOnce({ embeddings: [{ values: [40] }] });
    const { mod, mock } = await loadEmbeddingsModule({ embedImplementation: embedContent });

    const promise = mod.getEmbeddingsBatched(["one", "two", "three", "four"], 2);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual([[10], [20], [30], [40]]);
    expect(mock.GoogleGenAI).toHaveBeenCalledTimes(1);
    expect(mock.embedContent).toHaveBeenCalledTimes(4);
  });
});
