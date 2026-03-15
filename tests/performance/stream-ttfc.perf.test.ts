import { generateUUID } from "@/lib/utils";
import { expect, test } from "../fixtures";

/**
 * Performance tests — agent stream time-to-first-chunk (TTFC)
 *
 * TTFC is the most user-visible latency metric for a streaming chat
 * application: how long does the user wait before seeing any output?
 *
 * We measure:
 *  - TTFC: ms from POST until the first non-empty NDJSON line is received
 *  - TTLC: ms from POST until the stream is fully consumed (time-to-last-chunk)
 *  - Event count: sanity check that the stream emits all required events
 *
 * PLAYWRIGHT=true must be set so the mock agent is used.
 * Real LLM API calls have network variance that makes fixed thresholds
 * inappropriate; these tests are designed for the mock path only.
 *
 * Thresholds (ms) — mock agent path on localhost:
 *   TTFC  < 500 ms   (first NDJSON line arrives)
 *   TTLC  < 3000 ms  (entire stream consumed)
 */

const TTFC_THRESHOLD_MS = 500;
const TTLC_THRESHOLD_MS = 3000;

function userMessage(text: string) {
  return {
    id: generateUUID(),
    role: "user" as const,
    parts: [{ type: "text", text }],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Stream the response body line-by-line and return timing metrics.
 *
 * Playwright's APIResponse does not expose a streaming reader, so we
 * consume the full body via response.text() which buffers internally.
 * TTFC is therefore measured as the time from POST until the HTTP
 * response object is returned (i.e. headers + first data received),
 * and TTLC as the time until the body text is fully read.
 *
 * This is the most accurate measurement available via Playwright's
 * request API without dropping to raw fetch() / WebSocket.
 */
async function measureStream(
  postFn: () => Promise<import("@playwright/test").APIResponse>,
): Promise<{
  ttfc: number;
  ttlc: number;
  status: number;
  lineCount: number;
  eventTypes: string[];
}> {
  const t0 = performance.now();

  // TTFC = time until response object (headers) is available
  const response = await postFn();
  const ttfc = performance.now() - t0;

  // TTLC = time until body is fully consumed
  const body = await response.text();
  const ttlc = performance.now() - t0;

  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const eventTypes: string[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type) eventTypes.push(parsed.type);
    } catch {
      // ignore non-JSON lines
    }
  }

  return { ttfc, ttlc, status: response.status(), lineCount: lines.length, eventTypes };
}

test.describe("Agent stream — time-to-first-chunk", () => {
  test("main-agent TTFC is below 500 ms for a simple prompt", async ({
    adaContext,
  }) => {
    const { ttfc, ttlc, status, lineCount } = await measureStream(() =>
      adaContext.request.post("/api/chat", {
        data: {
          id: generateUUID(),
          message: userMessage("Why is the sky blue?"),
          selectedChatModel: "main-agent",
          selectedVisibilityType: "private",
        },
      }),
    );

    console.log(
      `[TTFC simple] status=${status}  ttfc=${ttfc.toFixed(1)}ms  ttlc=${ttlc.toFixed(1)}ms  lines=${lineCount}`,
    );

    expect(status).toBe(200);
    expect(ttfc).toBeLessThan(TTFC_THRESHOLD_MS);
  });

  test("main-agent TTLC (full stream) is below 3000 ms for a simple prompt", async ({
    adaContext,
  }) => {
    const { ttlc, status } = await measureStream(() =>
      adaContext.request.post("/api/chat", {
        data: {
          id: generateUUID(),
          message: userMessage("Why is grass green?"),
          selectedChatModel: "main-agent",
          selectedVisibilityType: "private",
        },
      }),
    );

    console.log(`[TTLC simple] status=${status}  ttlc=${ttlc.toFixed(1)}ms`);

    expect(status).toBe(200);
    expect(ttlc).toBeLessThan(TTLC_THRESHOLD_MS);
  });

  test("TTFC does not degrade across 5 sequential stream requests", async ({
    adaContext,
  }) => {
    const prompts = [
      "Why is the sky blue?",
      "Why is grass green?",
      "What's the weather in sf?",
      "What is Model Context Protocol?",
      "Why is the sky blue?",
    ];

    const ttfcs: number[] = [];

    for (const prompt of prompts) {
      const { ttfc, status } = await measureStream(() =>
        adaContext.request.post("/api/chat", {
          data: {
            id: generateUUID(),
            message: userMessage(prompt),
            selectedChatModel: "main-agent",
            selectedVisibilityType: "private",
          },
        }),
      );
      expect(status).toBe(200);
      ttfcs.push(ttfc);
    }

    const avgTtfc = ttfcs.reduce((a, b) => a + b, 0) / ttfcs.length;
    const maxTtfc = Math.max(...ttfcs);

    console.log(
      `[TTFC sequential x5] avg=${avgTtfc.toFixed(1)}ms  max=${maxTtfc.toFixed(1)}ms  all=${ttfcs.map((t) => t.toFixed(0)).join(",")}ms`,
    );

    // Average and worst-case both under threshold
    expect(avgTtfc).toBeLessThan(TTFC_THRESHOLD_MS);
    expect(maxTtfc).toBeLessThan(TTFC_THRESHOLD_MS * 2); // allow 2× spike
  });

  test("stream emits all required event types within TTLC threshold", async ({
    adaContext,
  }) => {
    const { ttlc, status, eventTypes } = await measureStream(() =>
      adaContext.request.post("/api/chat", {
        data: {
          id: generateUUID(),
          message: userMessage("Why is the sky blue?"),
          selectedChatModel: "main-agent",
          selectedVisibilityType: "private",
        },
      }),
    );

    console.log(
      `[stream events] ttlc=${ttlc.toFixed(1)}ms  types=${eventTypes.join("→")}`,
    );

    expect(status).toBe(200);
    expect(ttlc).toBeLessThan(TTLC_THRESHOLD_MS);
    expect(eventTypes).toContain("agent_started");
    expect(eventTypes).toContain("agent_stream");
    expect(eventTypes).toContain("agent_ended");
  });

  test("TTFC for a weather-tool prompt (tool invocation path) is below 500 ms", async ({
    adaContext,
  }) => {
    const { ttfc, ttlc, status } = await measureStream(() =>
      adaContext.request.post("/api/chat", {
        data: {
          id: generateUUID(),
          message: userMessage("What's the weather in sf?"),
          selectedChatModel: "main-agent",
          selectedVisibilityType: "private",
        },
      }),
    );

    console.log(
      `[TTFC tool path] status=${status}  ttfc=${ttfc.toFixed(1)}ms  ttlc=${ttlc.toFixed(1)}ms`,
    );

    expect(status).toBe(200);
    expect(ttfc).toBeLessThan(TTFC_THRESHOLD_MS);
    expect(ttlc).toBeLessThan(TTLC_THRESHOLD_MS);
  });

  test("continuation stream (second message in same chat) has TTFC below threshold", async ({
    adaContext,
  }) => {
    const chatId = generateUUID();

    // First message — warm up the chat
    const first = await measureStream(() =>
      adaContext.request.post("/api/chat", {
        data: {
          id: chatId,
          message: userMessage("Why is the sky blue?"),
          selectedChatModel: "main-agent",
          selectedVisibilityType: "private",
        },
      }),
    );
    expect(first.status).toBe(200);

    // Second message — same chatId
    const second = await measureStream(() =>
      adaContext.request.post("/api/chat", {
        data: {
          id: chatId,
          message: userMessage("And why is grass green?"),
          selectedChatModel: "main-agent",
          selectedVisibilityType: "private",
        },
      }),
    );

    console.log(
      `[TTFC continuation] first_ttfc=${first.ttfc.toFixed(1)}ms  second_ttfc=${second.ttfc.toFixed(1)}ms`,
    );

    expect(second.status).toBe(200);
    expect(second.ttfc).toBeLessThan(TTFC_THRESHOLD_MS);
  });
});
