import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Unit / Integration tests for lib/encryption.ts
 *
 * Covers:
 *  - encryptSecret / decryptSecret round-trip
 *  - encryptAgentSecrets / decryptAgentSecrets round-trip
 *  - isEncryptionConfigured() flag
 *  - Error cases: missing key, short key, tampered ciphertext
 *
 * No DB or network required — pure crypto logic.
 */

const VALID_SECRET = "a-very-long-and-secure-test-secret-key-32chars!!";

describe("encryption", () => {
  // Save and restore env around every test so mutations don't bleed
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.ENCRYPTION_SECRET;
    process.env.ENCRYPTION_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ENCRYPTION_SECRET;
    } else {
      process.env.ENCRYPTION_SECRET = originalSecret;
    }
  });

  // ─── isEncryptionConfigured ───────────────────────────────────────────────

  describe("isEncryptionConfigured()", () => {
    it("returns true when ENCRYPTION_SECRET is >= 32 chars", async () => {
      const { isEncryptionConfigured } = await import("@/lib/encryption");
      expect(isEncryptionConfigured()).toBe(true);
    });

    it("returns false when ENCRYPTION_SECRET is missing", async () => {
      delete process.env.ENCRYPTION_SECRET;
      // Re-import to pick up new env state
      const { isEncryptionConfigured } = await import("@/lib/encryption");
      expect(isEncryptionConfigured()).toBe(false);
    });

    it("returns false when ENCRYPTION_SECRET is shorter than 32 chars", async () => {
      process.env.ENCRYPTION_SECRET = "tooshort";
      const { isEncryptionConfigured } = await import("@/lib/encryption");
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  // ─── encryptSecret / decryptSecret ────────────────────────────────────────

  describe("encryptSecret() / decryptSecret()", () => {
    it("round-trips a simple string", async () => {
      const { encryptSecret, decryptSecret } = await import("@/lib/encryption");
      const plaintext = "my-api-key-123";
      const ciphertext = encryptSecret(plaintext);
      expect(decryptSecret(ciphertext)).toBe(plaintext);
    });

    it("round-trips an empty string", async () => {
      const { encryptSecret, decryptSecret } = await import("@/lib/encryption");
      const ciphertext = encryptSecret("");
      expect(decryptSecret(ciphertext)).toBe("");
    });

    it("round-trips a unicode / special-char string", async () => {
      const { encryptSecret, decryptSecret } = await import("@/lib/encryption");
      const plaintext = "key=🔑&token=abc+def/xyz==";
      expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
    });

    it("produces different ciphertext on each call (random IV)", async () => {
      const { encryptSecret } = await import("@/lib/encryption");
      const c1 = encryptSecret("same-value");
      const c2 = encryptSecret("same-value");
      expect(c1).not.toBe(c2);
    });

    it("ciphertext has three colon-separated segments (iv:tag:data)", async () => {
      const { encryptSecret } = await import("@/lib/encryption");
      const parts = encryptSecret("hello").split(":");
      expect(parts).toHaveLength(3);
      // Each segment is non-empty base64
      for (const part of parts) {
        expect(part.length).toBeGreaterThan(0);
      }
    });

    it("throws when ENCRYPTION_SECRET is missing at decrypt time", async () => {
      const { encryptSecret } = await import("@/lib/encryption");
      const ciphertext = encryptSecret("secret");

      delete process.env.ENCRYPTION_SECRET;
      const { decryptSecret } = await import("@/lib/encryption");
      expect(() => decryptSecret(ciphertext)).toThrow();
    });

    it("throws on a ciphertext with wrong number of segments", async () => {
      const { decryptSecret } = await import("@/lib/encryption");
      expect(() => decryptSecret("only:two")).toThrow("Invalid encrypted data format");
    });

    it("throws on a tampered (corrupted) ciphertext", async () => {
      const { encryptSecret, decryptSecret } = await import("@/lib/encryption");
      const ciphertext = encryptSecret("original");
      // Flip the last character of the encrypted data segment
      const parts = ciphertext.split(":");
      parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith("A") ? "B" : "A");
      expect(() => decryptSecret(parts.join(":"))).toThrow();
    });
  });

  // ─── encryptAgentSecrets / decryptAgentSecrets ────────────────────────────

  describe("encryptAgentSecrets() / decryptAgentSecrets()", () => {
    it("round-trips a single-key secrets object", async () => {
      const { encryptAgentSecrets, decryptAgentSecrets } = await import("@/lib/encryption");
      const secrets = { GITHUB_PAT: "ghp_abc123" };
      expect(decryptAgentSecrets(encryptAgentSecrets(secrets))).toEqual(secrets);
    });

    it("round-trips a multi-key secrets object", async () => {
      const { encryptAgentSecrets, decryptAgentSecrets } = await import("@/lib/encryption");
      const secrets = {
        GITHUB_PAT: "ghp_abc123",
        HF_TOKEN: "hf_xyz789",
        SERPER_API_KEY: "serper_key",
      };
      expect(decryptAgentSecrets(encryptAgentSecrets(secrets))).toEqual(secrets);
    });

    it("round-trips an empty secrets object", async () => {
      const { encryptAgentSecrets, decryptAgentSecrets } = await import("@/lib/encryption");
      expect(decryptAgentSecrets(encryptAgentSecrets({}))).toEqual({});
    });

    it("throws when trying to decrypt an invalid payload", async () => {
      const { decryptAgentSecrets } = await import("@/lib/encryption");
      expect(() => decryptAgentSecrets("not:valid")).toThrow();
    });
  });
});
