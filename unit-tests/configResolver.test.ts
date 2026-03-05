import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Integration tests for lib/agents/configResolver.ts
 *
 * Covers:
 *  - resolveAgentConfig() with no DB record → returns empty config
 *  - resolveAgentConfig() with a full DB record → decrypts secrets, maps LLM fields
 *  - resolveAgentConfig() when encryption is not configured → warns and returns empty
 *  - resolveAllAgentConfigs() merges configs from multiple agents
 *  - recomputeConfigVersion() produces a deterministic hash
 *
 * DB calls (getAgentConfiguration, getAllAgentConfigurations) are mocked so
 * no real database is required.
 */

// ─── Encryption helpers ────────────────────────────────────────────────────
const TEST_SECRET = "test-encryption-secret-that-is-long-enough-!1";

// ─── Shared mock state ─────────────────────────────────────────────────────
const dbMocks = {
  getAgentConfiguration: vi.fn(),
  getAllAgentConfigurations: vi.fn(),
};

vi.mock("@/lib/db/queries", () => ({
  getAgentConfiguration: (...args: unknown[]) =>
    dbMocks.getAgentConfiguration(...args),
  getAllAgentConfigurations: (...args: unknown[]) =>
    dbMocks.getAllAgentConfigurations(...args),
}));

describe("configResolver", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    process.env.ENCRYPTION_SECRET = TEST_SECRET;
    vi.resetModules();
    dbMocks.getAgentConfiguration.mockReset();
    dbMocks.getAllAgentConfigurations.mockReset();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ENCRYPTION_SECRET;
    } else {
      process.env.ENCRYPTION_SECRET = originalSecret;
    }
  });

  // ─── resolveAgentConfig ──────────────────────────────────────────────────

  describe("resolveAgentConfig()", () => {
    it("returns empty llmConfig and secrets when no DB record exists", async () => {
      dbMocks.getAgentConfiguration.mockResolvedValue(null);
      const { resolveAgentConfig } = await import("@/lib/agents/configResolver");

      const result = await resolveAgentConfig("user-1", "search-agent");
      expect(result.llmConfig).toEqual({});
      expect(result.secrets).toEqual({});
    });

    it("returns empty config when encryption is not configured", async () => {
      delete process.env.ENCRYPTION_SECRET;
      const { resolveAgentConfig } = await import("@/lib/agents/configResolver");

      const result = await resolveAgentConfig("user-1", "search-agent");
      expect(result.llmConfig).toEqual({});
      expect(result.secrets).toEqual({});
    });

    it("maps provider and modelId into llmConfig from a cloud deployment record", async () => {
      dbMocks.getAgentConfiguration.mockResolvedValue({
        id: "cfg-1",
        userId: "user-1",
        agentId: "search-agent",
        deploymentType: "cloud",
        provider: "openai",
        modelId: "gpt-4o",
        apiKey: null,
        baseUrl: null,
        chatTemplate: null,
        customTemplate: null,
        agentSecrets: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { resolveAgentConfig } = await import("@/lib/agents/configResolver");
      const result = await resolveAgentConfig("user-1", "search-agent");

      expect(result.llmConfig).toMatchObject({
        provider: "openai",
        modelID: "gpt-4o",
      });
    });

    it("decrypts an encrypted API key into llmConfig", async () => {
      const { encryptSecret } = await import("@/lib/encryption");
      const encryptedKey = encryptSecret("sk-real-openai-key");

      dbMocks.getAgentConfiguration.mockResolvedValue({
        id: "cfg-2",
        userId: "user-1",
        agentId: "coding-agent",
        deploymentType: "cloud",
        provider: "openai",
        modelId: "gpt-4o-mini",
        apiKey: encryptedKey,
        baseUrl: null,
        chatTemplate: null,
        customTemplate: null,
        agentSecrets: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { resolveAgentConfig } = await import("@/lib/agents/configResolver");
      const result = await resolveAgentConfig("user-1", "coding-agent");

      expect(result.llmConfig.apiKey).toBe("sk-real-openai-key");
    });

    it("decrypts agentSecrets into the secrets map", async () => {
      const { encryptAgentSecrets } = await import("@/lib/encryption");
      const encryptedSecrets = encryptAgentSecrets({
        GITHUB_PAT: "ghp_abc123",
        HF_TOKEN: "hf_xyz789",
      });

      dbMocks.getAgentConfiguration.mockResolvedValue({
        id: "cfg-3",
        userId: "user-1",
        agentId: "github-agent",
        deploymentType: "cloud",
        provider: "google",
        modelId: "gemini-2.0-flash",
        apiKey: null,
        baseUrl: null,
        chatTemplate: null,
        customTemplate: null,
        agentSecrets: encryptedSecrets,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { resolveAgentConfig } = await import("@/lib/agents/configResolver");
      const result = await resolveAgentConfig("user-1", "github-agent");

      expect(result.secrets).toEqual({
        GITHUB_PAT: "ghp_abc123",
        HF_TOKEN: "hf_xyz789",
      });
    });

    it("returns empty secrets when agentSecrets is null", async () => {
      dbMocks.getAgentConfiguration.mockResolvedValue({
        id: "cfg-4",
        userId: "user-1",
        agentId: "vision-agent",
        deploymentType: "cloud",
        provider: "google",
        modelId: "gemini-2.0-flash",
        apiKey: null,
        baseUrl: null,
        chatTemplate: null,
        customTemplate: null,
        agentSecrets: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { resolveAgentConfig } = await import("@/lib/agents/configResolver");
      const result = await resolveAgentConfig("user-1", "vision-agent");

      expect(result.secrets).toEqual({});
    });

    it("maps baseUrl for self-hosted deployments", async () => {
      dbMocks.getAgentConfiguration.mockResolvedValue({
        id: "cfg-5",
        userId: "user-1",
        agentId: "coding-agent",
        deploymentType: "self-hosted",
        provider: "ollama",
        modelId: "llama3",
        apiKey: null,
        baseUrl: "https://my-ollama.ngrok.io",
        chatTemplate: null,
        customTemplate: null,
        agentSecrets: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { resolveAgentConfig } = await import("@/lib/agents/configResolver");
      const result = await resolveAgentConfig("user-1", "coding-agent");

      expect(result.llmConfig.baseURL).toBe("https://my-ollama.ngrok.io");
    });

    it("gracefully returns empty config when DB throws", async () => {
      dbMocks.getAgentConfiguration.mockRejectedValue(new Error("DB timeout"));
      const { resolveAgentConfig } = await import("@/lib/agents/configResolver");

      const result = await resolveAgentConfig("user-1", "any-agent");
      expect(result.llmConfig).toEqual({});
      expect(result.secrets).toEqual({});
    });
  });

  // ─── resolveAllAgentConfigs ──────────────────────────────────────────────

  describe("resolveAllAgentConfigs()", () => {
    it("returns an empty object when user has no configurations", async () => {
      dbMocks.getAllAgentConfigurations.mockResolvedValue([]);
      dbMocks.getAgentConfiguration.mockResolvedValue(null);
      const { resolveAllAgentConfigs } = await import("@/lib/agents/configResolver");

      const result = await resolveAllAgentConfigs("user-1");
      expect(result).toEqual({});
    });

    it("returns a map keyed by agentId for each configured agent", async () => {
      const { encryptAgentSecrets } = await import("@/lib/encryption");

      dbMocks.getAllAgentConfigurations.mockResolvedValue([
        {
          id: "cfg-a",
          userId: "user-1",
          agentId: "github-agent",
          deploymentType: "cloud",
          provider: "google",
          modelId: "gemini-2.0-flash",
          apiKey: null,
          baseUrl: null,
          chatTemplate: null,
          customTemplate: null,
          agentSecrets: encryptAgentSecrets({ GITHUB_PAT: "ghp_test" }),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "cfg-b",
          userId: "user-1",
          agentId: "search-agent",
          deploymentType: "cloud",
          provider: "openai",
          modelId: "gpt-4o",
          apiKey: null,
          baseUrl: null,
          chatTemplate: null,
          customTemplate: null,
          agentSecrets: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const { resolveAllAgentConfigs } = await import("@/lib/agents/configResolver");
      const result = await resolveAllAgentConfigs("user-1");

      expect(result).toHaveProperty("github-agent");
      expect(result).toHaveProperty("search-agent");
      expect(result["github-agent"].secrets).toEqual({ GITHUB_PAT: "ghp_test" });
      expect(result["search-agent"].llmConfig).toMatchObject({ provider: "openai" });
    });
  });

  // ─── recomputeConfigVersion ──────────────────────────────────────────────

  describe("recomputeConfigVersion()", () => {
    it("returns a non-empty string hash", async () => {
      const { recomputeConfigVersion } = await import("@/lib/agents/configResolver");
      const version = recomputeConfigVersion({ provider: "google", modelID: "gemini" }, {});
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });

    it("same config and secrets produce the same version (deterministic)", async () => {
      const { recomputeConfigVersion } = await import("@/lib/agents/configResolver");
      const config = { provider: "openai", modelID: "gpt-4o" };
      const secrets = { OPENAI_API_KEY: "sk-key" };

      const v1 = recomputeConfigVersion(config, secrets);
      const v2 = recomputeConfigVersion(config, secrets);
      expect(v1).toBe(v2);
    });

    it("different configs produce different versions", async () => {
      const { recomputeConfigVersion } = await import("@/lib/agents/configResolver");
      const v1 = recomputeConfigVersion({ provider: "google" }, {});
      const v2 = recomputeConfigVersion({ provider: "openai" }, {});
      expect(v1).not.toBe(v2);
    });

    /**
     * NOTE: recomputeConfigVersion hashes only secret KEYS and a hasSecrets boolean,
     * not the secret values themselves (by design, to avoid leaking secrets into logs).
     * Therefore two calls with the same key but different values produce the SAME hash.
     * This test verifies that behaviour matches the implementation.
     */
    it("same secret keys with different values produce the same version (keys-only hashing)", async () => {
      const { recomputeConfigVersion } = await import("@/lib/agents/configResolver");
      const config = { provider: "google" };
      const v1 = recomputeConfigVersion(config, { KEY: "abc" });
      const v2 = recomputeConfigVersion(config, { KEY: "xyz" });
      expect(v1).toBe(v2);
    });

    it("different secret keys produce different versions", async () => {
      const { recomputeConfigVersion } = await import("@/lib/agents/configResolver");
      const config = { provider: "google" };
      const v1 = recomputeConfigVersion(config, { KEY_A: "abc" });
      const v2 = recomputeConfigVersion(config, { KEY_B: "abc" });
      expect(v1).not.toBe(v2);
    });

    it("secrets present vs no secrets produce different versions", async () => {
      const { recomputeConfigVersion } = await import("@/lib/agents/configResolver");
      const config = { provider: "google" };
      const v1 = recomputeConfigVersion(config, {});
      const v2 = recomputeConfigVersion(config, { SOME_KEY: "value" });
      expect(v1).not.toBe(v2);
    });
  });
});
