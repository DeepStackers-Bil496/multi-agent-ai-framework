import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for lib/testing/mock-agent-response.ts
 *
 * Verifies that createMockAgentResponse():
 *  - Returns a proper Response with a readable stream
 *  - Emits AGENT_STARTED → N×AGENT_STREAM → AGENT_ENDED in order
 *  - Maps known prompts to the correct canned answer
 *  - Handles unknown prompts gracefully
 *  - Uses the correct agentId / agentName in event payloads
 *
 * No network or DB required.
 */

/** Read a streaming Response body to a flat list of parsed JSON events */
async function drainStream(
  response: Response
): Promise<Array<Record<string, unknown>>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }

  return raw
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

describe("createMockAgentResponse()", () => {
  let createMockAgentResponse: typeof import("@/lib/testing/mock-agent-response").createMockAgentResponse;

  beforeEach(async () => {
    vi.resetModules();
    ({ createMockAgentResponse } = await import("@/lib/testing/mock-agent-response"));
  });

  // ─── Response structure ──────────────────────────────────────────────────

  it("returns a Response instance", () => {
    const response = createMockAgentResponse({
      agentId: "main-agent",
      agentName: "Main Agent",
      inputMessages: [{ role: "user", content: "Hello" }],
    });

    expect(response).toBeInstanceOf(Response);
  });

  it("response body is not null", () => {
    const response = createMockAgentResponse({
      agentId: "main-agent",
      agentName: "Main Agent",
      inputMessages: [{ role: "user", content: "Hello" }],
    });

    expect(response.body).not.toBeNull();
  });

  it("content-type header is application/json", () => {
    const response = createMockAgentResponse({
      agentId: "main-agent",
      agentName: "Main Agent",
      inputMessages: [{ role: "user", content: "Hello" }],
    });

    expect(response.headers.get("content-type")).toContain("application/json");
  });

  // ─── Event sequence ──────────────────────────────────────────────────────

  it("emits events in order: AGENT_STARTED → AGENT_STREAM(s) → AGENT_ENDED", async () => {
    const response = createMockAgentResponse({
      agentId: "main-agent",
      agentName: "Main Agent",
      inputMessages: [{ role: "user", content: "Why is the sky blue?" }],
    });

    const events = await drainStream(response);
    const types = events.map((e) => e.type as string);

    expect(types[0]).toBe("agent_started");
    expect(types[types.length - 1]).toBe("agent_ended");

    const streamEvents = types.filter((t) => t === "agent_stream");
    expect(streamEvents.length).toBeGreaterThan(0);
  });

  it("AGENT_STARTED payload contains agentId and agentName", async () => {
    const response = createMockAgentResponse({
      agentId: "search-agent",
      agentName: "Search Agent",
      inputMessages: [{ role: "user", content: "search something" }],
    });

    const events = await drainStream(response);
    const started = events.find((e) => e.type === "agent_started") as {
      payload: { id: string; name: string };
    };

    expect(started.payload.id).toBe("search-agent");
    expect(started.payload.name).toBe("Search Agent");
  });

  it("AGENT_ENDED payload contains agentId", async () => {
    const response = createMockAgentResponse({
      agentId: "coding-agent",
      agentName: "Coding Agent",
      inputMessages: [{ role: "user", content: "write code" }],
    });

    const events = await drainStream(response);
    const ended = events.find((e) => e.type === "agent_ended") as {
      payload: { id: string };
    };

    expect(ended.payload.id).toBe("coding-agent");
  });

  it("all AGENT_STREAM content chunks concatenated form the expected response", async () => {
    const response = createMockAgentResponse({
      agentId: "main-agent",
      agentName: "Main Agent",
      inputMessages: [{ role: "user", content: "Why is the sky blue?" }],
    });

    const events = await drainStream(response);
    const allContent = events
      .filter((e) => e.type === "agent_stream")
      .map((e) => (e as { payload: { content: string } }).payload.content)
      .join("");

    expect(allContent.toLowerCase()).toContain("blue");
  });

  // ─── Known prompt mappings ───────────────────────────────────────────────

  const knownPrompts: Array<{ prompt: string; fragment: string }> = [
    { prompt: "Why is the sky blue?", fragment: "blue" },
    { prompt: "Why is grass green?", fragment: "green" },
    { prompt: "What's the weather in SF?", fragment: "San Francisco" },
    { prompt: "What is Model Context Protocol?", fragment: "Model Context Protocol" },
  ];

  for (const { prompt, fragment } of knownPrompts) {
    it(`prompt "${prompt}" → response contains "${fragment}"`, async () => {
      const response = createMockAgentResponse({
        agentId: "main-agent",
        agentName: "Main Agent",
        inputMessages: [{ role: "user", content: prompt }],
      });

      const events = await drainStream(response);
      const content = events
        .filter((e) => e.type === "agent_stream")
        .map((e) => (e as { payload: { content: string } }).payload.content)
        .join("");

      expect(content.toLowerCase()).toContain(fragment.toLowerCase());
    });
  }

  // ─── Unknown / empty prompts ─────────────────────────────────────────────

  it("unknown prompt returns a non-empty fallback response", async () => {
    const response = createMockAgentResponse({
      agentId: "main-agent",
      agentName: "Main Agent",
      inputMessages: [{ role: "user", content: "some completely unknown query xyz" }],
    });

    const events = await drainStream(response);
    const content = events
      .filter((e) => e.type === "agent_stream")
      .map((e) => (e as { payload: { content: string } }).payload.content)
      .join("");

    expect(content.length).toBeGreaterThan(0);
  });

  it("empty input messages still completes the stream", async () => {
    const response = createMockAgentResponse({
      agentId: "main-agent",
      agentName: "Main Agent",
      inputMessages: [],
    });

    const events = await drainStream(response);
    const types = events.map((e) => e.type as string);

    expect(types).toContain("agent_started");
    expect(types).toContain("agent_ended");
  });

  it("uses the last user message when there are multiple turns", async () => {
    const response = createMockAgentResponse({
      agentId: "main-agent",
      agentName: "Main Agent",
      inputMessages: [
        { role: "user", content: "first message" },
        { role: "assistant", content: "first reply" },
        { role: "user", content: "Why is the sky blue?" },
      ],
    });

    const events = await drainStream(response);
    const content = events
      .filter((e) => e.type === "agent_stream")
      .map((e) => (e as { payload: { content: string } }).payload.content)
      .join("");

    // Should respond to the last user message, not the first
    expect(content.toLowerCase()).toContain("blue");
  });
});
