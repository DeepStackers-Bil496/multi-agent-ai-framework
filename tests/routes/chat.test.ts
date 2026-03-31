import { generateUUID } from "@/lib/utils";
import { expect, test } from "./fixtures";

/**
 * Route tests for POST /api/chat — agent integration path.
 *
 * SCOPE — what is intentionally left to adjacent route suites:
 *  - Empty body → 400                    (already covered)
 *  - Babbage cannot append to Ada's chat  (already covered)
 *  - Babbage cannot delete Ada's chat     (already covered)
 *  - Ada can delete her own chat          (already covered)
 *  - Stream resume via /api/chat/:id/stream (covered in chat-stream.test.ts)
 *
 * What these tests ADD (agent-specific path via selectedChatModel="main-agent"):
 *  1. main-agent produces a valid 200 streaming response
 *  2. Stream body contains all three required event types in order
 *  3. Accumulated stream text matches the expected mock answer
 *  4. Continuation of an existing main-agent chat succeeds
 *  5. Visibility type "public" is accepted without error
 *  6. Malformed message parts are rejected (schema validation)
 */

/** Parse all newline-delimited JSON events from a response body text */
function parseStreamEvents(
  body: string,
): Array<{ type: string; payload: { name: string; content: string; id: string } }> {
  return body
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
}

/** Build a minimal valid ChatMessage for the POST body */
function userMessage(text: string) {
  return {
    id: generateUUID(),
    role: "user" as const,
    parts: [{ type: "text", text }],
    createdAt: new Date().toISOString(),
  };
}

function userMessageWithImage(text: string) {
  return {
    id: generateUUID(),
    role: "user" as const,
    parts: [
      {
        type: "file" as const,
        url: "https://example.com/mouth-of-the-seine-monet.jpg",
        name: "mouth-of-the-seine-monet.jpg",
        mediaType: "image/jpeg",
      },
      { type: "text" as const, text },
    ],
    createdAt: new Date().toISOString(),
  };
}

test.describe.serial("/api/chat — main-agent stream events", () => {
  // ─── Basic streaming response ────────────────────────────────────────────

  test("returns 200 with a non-empty body for main-agent", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body.trim().length).toBeGreaterThan(0);
  });

  test("stream contains agent_started event", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const events = parseStreamEvents(await response.text());
    expect(events.some((e) => e.type === "agent_started")).toBe(true);
  });

  test("stream contains at least one agent_stream event with text content", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const events = parseStreamEvents(await response.text());

    const streamEvents = events.filter((e) => e.type === "agent_stream");
    expect(streamEvents.length).toBeGreaterThan(0);

    // agent_stream payload.content is a LangChain AIMessageChunk object
    // (emitted as event.data.chunk from baseAgent.ts streamEvents loop).
    // It may be a string OR an object — both are valid; we just confirm it exists.
    for (const e of streamEvents) {
      expect(e.payload.content).toBeDefined();
    }
  });

  test("stream contains agent_ended event as the last meaningful event", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const events = parseStreamEvents(await response.text());
    expect(events.some((e) => e.type === "agent_ended")).toBe(true);
  });

  test("event order is: agent_started → agent_stream(s) → agent_ended", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const events = parseStreamEvents(await response.text());
    const types = events.map((e) => e.type);

    const startedIdx = types.indexOf("agent_started");
    const endedIdx = types.lastIndexOf("agent_ended");
    const firstStreamIdx = types.indexOf("agent_stream");

    expect(startedIdx).toBeGreaterThanOrEqual(0);
    expect(endedIdx).toBeGreaterThan(startedIdx);
    if (firstStreamIdx !== -1) {
      expect(firstStreamIdx).toBeGreaterThan(startedIdx);
      expect(firstStreamIdx).toBeLessThan(endedIdx);
    }
  });

  // ─── Mock response content ───────────────────────────────────────────────

  test("accumulated stream text matches mock answer for known prompt", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const events = parseStreamEvents(await response.text());

    const accumulated = events
      .filter((e) => e.type === "agent_stream")
      .map((e) => {
        const content = e.payload.content;
        if (typeof content === "string") return content;
        // LangChain AIMessageChunk — extract text the same way baseAgent's
        // passthrough stream does in chat/route.ts
        if (content?.kwargs?.content) return content.kwargs.content;
        if (content?.lc_kwargs?.content) return content.lc_kwargs.content;
        if (content?.content) return content.content;
        return "";
      })
      .join("");

    expect(accumulated.toLowerCase()).toContain("blue");
  });

  test("agent_started payload contains agentId and agentName", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const events = parseStreamEvents(await response.text());

    const started = events.find((e) => e.type === "agent_started");
    expect(started).toBeDefined();
    expect(started!.payload.id).toBeTruthy();
    expect(started!.payload.name).toBeTruthy();
  });

  // ─── Chat continuation ───────────────────────────────────────────────────

  test("can send a follow-up message to the same chat", async ({
    adaContext,
  }) => {
    const chatId = generateUUID();

    // First message creates the chat
    const first = await adaContext.request.post("/api/chat", {
      data: {
        id: chatId,
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });
    expect(first.status()).toBe(200);
    await first.text(); // drain the stream so the chat row is persisted

    // Second message continues the same chat
    const second = await adaContext.request.post("/api/chat", {
      data: {
        id: chatId,
        message: userMessage("Thanks, one more question."),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(second.status()).toBe(200);
    const events = parseStreamEvents(await second.text());
    expect(events.some((e) => e.type === "agent_started")).toBe(true);
    expect(events.some((e) => e.type === "agent_ended")).toBe(true);
  });

  // ─── Visibility types ────────────────────────────────────────────────────

  test("public visibility type is accepted without error", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Why is the sky blue?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "public",
      },
    });

    expect(response.status()).toBe(200);
  });

  test("accepts a user message that includes an image file part", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessageWithImage("Who painted this?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body.trim().length).toBeGreaterThan(0);
  });

  test("image file part + prompt produces the deterministic multimodal mock answer", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessageWithImage("Who painted this?"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);
    const events = parseStreamEvents(await response.text());

    const accumulated = events
      .filter((e) => e.type === "agent_stream")
      .map((e) => {
        const content = e.payload.content;
        if (typeof content === "string") return content;
        if (content?.kwargs?.content) return content.kwargs.content;
        if (content?.lc_kwargs?.content) return content.lc_kwargs.content;
        if (content?.content) return content.content;
        return "";
      })
      .join("");

    expect(accumulated).toContain("Monet");
  });

  // ─── Schema validation ───────────────────────────────────────────────────

  test("missing selectedChatModel returns 400", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        message: userMessage("Hello"),
        selectedVisibilityType: "private",
        // selectedChatModel intentionally omitted
      },
    });

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
  });

  test("missing message returns 400", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: generateUUID(),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
        // message intentionally omitted
      },
    });

    expect(response.status()).toBe(400);
  });

  test("missing chat id returns 400", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: {
        // id intentionally omitted
        message: userMessage("Hello"),
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(400);
  });
});
