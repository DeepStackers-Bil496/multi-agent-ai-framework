import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLLM } from "@/lib/agents/llmFactory";
import type { LLMImplMetadata, LLMProvider } from "@/lib/types";

const constructorSpies = vi.hoisted(() => ({
  google: vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this.provider = "google";
    this.options = options;
  }),
  openai: vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this.provider = "openai";
    this.options = options;
  }),
  groq: vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this.provider = "groq";
    this.options = options;
  }),
  ollama: vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this.provider = "ollama";
    this.options = options;
  }),
  anthropic: vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this.provider = "anthropic";
    this.options = options;
  }),
  mistral: vi.fn(function (this: Record<string, unknown>, options: unknown) {
    this.provider = "mistral";
    this.options = options;
  }),
}));

vi.mock("@langchain/google-genai", () => ({
  ChatGoogleGenerativeAI: constructorSpies.google,
}));

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: constructorSpies.openai,
}));

vi.mock("@langchain/groq", () => ({
  ChatGroq: constructorSpies.groq,
}));

vi.mock("@langchain/ollama", () => ({
  ChatOllama: constructorSpies.ollama,
}));

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: constructorSpies.anthropic,
}));

vi.mock("@langchain/mistralai", () => ({
  ChatMistralAI: constructorSpies.mistral,
}));

type FakeModel = {
  provider: string;
  options: Record<string, unknown>;
};

function makeConfig(
  overrides: Partial<LLMImplMetadata> = {}
): LLMImplMetadata {
  return {
    type: "api",
    provider: "openai",
    modelID: "test-model",
    systemInstruction: "You are a test model.",
    ...overrides,
  };
}

describe("createLLM", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("creates a Google Gemini model with the provided API key", () => {
    const llm = createLLM(
      makeConfig({
        provider: "google",
        apiKey: "gemini-test-key",
      })
    ) as FakeModel;

    expect(constructorSpies.google).toHaveBeenCalledWith({
      model: "test-model",
      apiKey: "gemini-test-key",
    });
    expect(llm.provider).toBe("google");
  });

  it("throws when Google is selected without an API key", () => {
    expect(() =>
      createLLM(
        makeConfig({
          provider: "google",
          apiKey: undefined,
        })
      )
    ).toThrow("Gemini requires GEMINI_API_KEY");
    expect(constructorSpies.google).not.toHaveBeenCalled();
  });

  it("creates an OpenAI model and forwards baseURL overrides", () => {
    const llm = createLLM(
      makeConfig({
        provider: "openai",
        apiKey: "openai-test-key",
        baseURL: "http://localhost:8001/v1",
      })
    ) as FakeModel;

    expect(constructorSpies.openai).toHaveBeenCalledWith({
      model: "test-model",
      apiKey: "openai-test-key",
      configuration: {
        baseURL: "http://localhost:8001/v1",
      },
    });
    expect(llm.provider).toBe("openai");
  });

  it("uses the EMPTY fallback key for OpenAI-compatible servers without apiKey", () => {
    createLLM(
      makeConfig({
        provider: "openai",
        apiKey: undefined,
      })
    );

    expect(constructorSpies.openai).toHaveBeenCalledWith({
      model: "test-model",
      apiKey: "EMPTY",
      configuration: undefined,
    });
  });

  it.each([
    {
      provider: "groq" as const,
      ctor: constructorSpies.groq,
      error: "Groq requires GROQ_API_KEY",
    },
    {
      provider: "anthropic" as const,
      ctor: constructorSpies.anthropic,
      error: "Anthropic requires ANTHROPIC_API_KEY",
    },
    {
      provider: "mistral" as const,
      ctor: constructorSpies.mistral,
      error: "Mistral requires MISTRAL_API_KEY",
    },
  ])("throws when $provider is selected without an API key", ({ provider, ctor, error }) => {
    expect(() =>
      createLLM(
        makeConfig({
          provider,
          apiKey: undefined,
        })
      )
    ).toThrow(error);
    expect(ctor).not.toHaveBeenCalled();
  });

  it.each([
    {
      provider: "groq" as const,
      ctor: constructorSpies.groq,
      expected: {
        model: "test-model",
        apiKey: "provider-key",
      },
    },
    {
      provider: "anthropic" as const,
      ctor: constructorSpies.anthropic,
      expected: {
        model: "test-model",
        apiKey: "provider-key",
      },
    },
    {
      provider: "mistral" as const,
      ctor: constructorSpies.mistral,
      expected: {
        model: "test-model",
        apiKey: "provider-key",
      },
    },
  ])("creates the correct constructor for $provider", ({ provider, ctor, expected }) => {
    createLLM(
      makeConfig({
        provider,
        apiKey: "provider-key",
      })
    );

    expect(ctor).toHaveBeenCalledWith(expected);
  });

  it("creates a local Ollama model with the default baseUrl", () => {
    const llm = createLLM(
      makeConfig({
        provider: "ollama",
        apiKey: undefined,
      })
    ) as FakeModel;

    expect(constructorSpies.ollama).toHaveBeenCalledWith({
      model: "test-model",
      baseUrl: "http://localhost:11434",
    });
    expect(llm.provider).toBe("ollama");
  });

  it("creates an Ollama Cloud model with auth headers", () => {
    createLLM(
      makeConfig({
        provider: "ollama-cloud",
        apiKey: "ollama-cloud-key",
        baseURL: "https://custom.ollama.example",
      })
    );

    expect(constructorSpies.ollama).toHaveBeenCalledWith({
      model: "test-model",
      baseUrl: "https://custom.ollama.example",
      headers: { Authorization: "Bearer ollama-cloud-key" },
    });
  });

  it("throws when Ollama Cloud is selected without an API key", () => {
    expect(() =>
      createLLM(
        makeConfig({
          provider: "ollama-cloud",
          apiKey: undefined,
        })
      )
    ).toThrow("Ollama Cloud requires an API key");
    expect(constructorSpies.ollama).not.toHaveBeenCalled();
  });

  it.each([
    {
      provider: "lmstudio" as const,
      expectedApiKey: "lm-studio",
      expectedBaseURL: "http://localhost:1234/v1",
    },
    {
      provider: "localai" as const,
      expectedApiKey: "localai",
      expectedBaseURL: "http://localhost:8080/v1",
    },
    {
      provider: "llamacpp" as const,
      expectedApiKey: "llamacpp",
      expectedBaseURL: "http://localhost:8000/v1",
    },
    {
      provider: "textgenwebui" as const,
      expectedApiKey: "textgenwebui",
      expectedBaseURL: "http://localhost:5000/v1",
    },
  ])(
    "creates an OpenAI-compatible client for $provider with the default baseURL",
    ({ provider, expectedApiKey, expectedBaseURL }) => {
      createLLM(
        makeConfig({
          provider,
          apiKey: undefined,
          baseURL: undefined,
        })
      );

      expect(constructorSpies.openai).toHaveBeenCalledWith({
        model: "test-model",
        apiKey: expectedApiKey,
        configuration: {
          baseURL: expectedBaseURL,
        },
      });
    }
  );

  it("creates a custom OpenAI-compatible client and preserves explicit baseURL", () => {
    createLLM(
      makeConfig({
        provider: "custom",
        apiKey: "custom-key",
        baseURL: "https://llm.example.com/v1",
      })
    );

    expect(constructorSpies.openai).toHaveBeenCalledWith({
      model: "test-model",
      apiKey: "custom-key",
      configuration: {
        baseURL: "https://llm.example.com/v1",
      },
    });
  });

  it("uses the fallback custom API key when the custom endpoint does not require auth", () => {
    createLLM(
      makeConfig({
        provider: "custom",
        apiKey: undefined,
        baseURL: "https://llm.example.com/v1",
      })
    );

    expect(constructorSpies.openai).toHaveBeenCalledWith({
      model: "test-model",
      apiKey: "custom",
      configuration: {
        baseURL: "https://llm.example.com/v1",
      },
    });
  });

  it("throws when the custom provider is selected without baseURL", () => {
    expect(() =>
      createLLM(
        makeConfig({
          provider: "custom",
          baseURL: undefined,
        })
      )
    ).toThrow("Custom provider requires a baseURL");
  });

  it("throws for an unknown provider", () => {
    expect(() =>
      createLLM(
        makeConfig({
          provider: "not-a-provider" as unknown as LLMProvider,
        })
      )
    ).toThrow("Unknown LLM provider: not-a-provider");
  });
});
