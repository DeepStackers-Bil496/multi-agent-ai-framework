import { describe, it, expect } from "vitest";

/**
 * Tests for lib/utils.ts and lib/constants.ts
 *
 * Covers:
 * - cn() utility combines classnames correctly
 * - guestRegex matches/rejects correctly  (pattern: /^guest-\d+$/)
 * - generateUUID() produces a valid UUID v4
 * - sanitizeText() trims whitespace
 * - getTextFromMessage() extracts text content from a message object
 */

describe("cn() utility", () => {
  it("merges class strings", async () => {
    const { cn } = await import("@/lib/utils");
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes (falsy values omitted)", async () => {
    const { cn } = await import("@/lib/utils");
    expect(cn("foo", false && "bar", undefined, "baz")).toBe("foo baz");
  });

  it("resolves Tailwind conflicts (last class wins)", async () => {
    const { cn } = await import("@/lib/utils");
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4");
  });
});

describe("guestRegex constant", () => {
  // Real pattern: /^guest-\d+$/
  it("matches a valid guest id (guest-123)", async () => {
    const { guestRegex } = await import("@/lib/constants");
    expect(guestRegex.test("guest-123")).toBe(true);
  });

  it("matches guest-0", async () => {
    const { guestRegex } = await import("@/lib/constants");
    expect(guestRegex.test("guest-0")).toBe(true);
  });

  it("does not match a regular user email", async () => {
    const { guestRegex } = await import("@/lib/constants");
    expect(guestRegex.test("john.doe@example.com")).toBe(false);
  });

  it("does not match guest with letters after dash", async () => {
    const { guestRegex } = await import("@/lib/constants");
    expect(guestRegex.test("guest-abc")).toBe(false);
  });

  it("does not match partial guest string", async () => {
    const { guestRegex } = await import("@/lib/constants");
    expect(guestRegex.test("myguest-123")).toBe(false);
  });
});

describe("generateUUID", () => {
  it("returns a string matching UUID v4 format", async () => {
    const { generateUUID } = await import("@/lib/utils");
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("generates unique values on each call", async () => {
    const { generateUUID } = await import("@/lib/utils");
    expect(generateUUID()).not.toBe(generateUUID());
  });
});

describe("sanitizeText", () => {
  it("returns the text unchanged for normal strings", async () => {
    const { sanitizeText } = await import("@/lib/utils");
    expect(sanitizeText("hello world")).toBe("hello world");
  });

  it("handles empty string", async () => {
    const { sanitizeText } = await import("@/lib/utils");
    expect(sanitizeText("")).toBe("");
  });
});

describe("getTextFromMessage", () => {
  it("extracts text content from a message with text parts", async () => {
    const { getTextFromMessage } = await import("@/lib/utils");
    const message = {
      role: "user" as const,
      parts: [{ type: "text", text: "Hello world" }],
    };
    const result = getTextFromMessage(message as never);
    expect(typeof result).toBe("string");
    expect(result).toContain("Hello");
  });

  it("returns a string for an assistant message", async () => {
    const { getTextFromMessage } = await import("@/lib/utils");
    const message = {
      role: "assistant" as const,
      parts: [{ type: "text", text: "I can help with that." }],
    };
    const result = getTextFromMessage(message as never);
    expect(typeof result).toBe("string");
  });
});
