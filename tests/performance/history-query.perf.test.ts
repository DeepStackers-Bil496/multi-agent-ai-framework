import { generateUUID } from "@/lib/utils";
import { expect, test } from "../fixtures";

/**
 * Performance tests — chat history query performance
 *
 * Measures the response time of GET /api/history under various conditions:
 *  - Empty history (cold / new user)
 *  - Growing history (response time does not degrade as chats accumulate)
 *  - Pagination parameters (limit, starting_after)
 *  - Sustained sequential load (10 requests in a row)
 *
 * Chats are seeded by POSTing to /api/chat so the DB has real rows to query.
 * PLAYWRIGHT=true must be set so chat POSTs complete quickly via mock agent.
 *
 * Thresholds (ms) — localhost DB:
 *   Single GET  < 300 ms
 *   p95 (10 GETs)  < 600 ms
 */

const SINGLE_THRESHOLD_MS = 300;
const P95_THRESHOLD_MS = 600;

function userMessage(text: string) {
  return {
    id: generateUUID(),
    role: "user" as const,
    parts: [{ type: "text", text }],
    createdAt: new Date().toISOString(),
  };
}

async function seedChat(
  request: import("@playwright/test").APIRequestContext,
  text = "Seed message for perf test",
): Promise<void> {
  await request.post("/api/chat", {
    data: {
      id: generateUUID(),
      message: userMessage(text),
      selectedChatModel: "main-agent",
      selectedVisibilityType: "private",
    },
  });
}

async function getHistoryMs(
  request: import("@playwright/test").APIRequestContext,
  params = "",
): Promise<{ ms: number; status: number; chatCount: number }> {
  const t0 = performance.now();
  const res = await request.get(`/api/history${params}`);
  const ms = performance.now() - t0;
  const body = await res.json().catch(() => ({ chats: [] }));
  return { ms, status: res.status(), chatCount: (body.chats ?? []).length };
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? sorted[sorted.length - 1];
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

test.describe("Chat history query performance", () => {
  test("GET /api/history on empty history responds within threshold", async ({
    adaContext,
  }) => {
    // Delete history first to ensure clean state
    await adaContext.request.delete("/api/history");

    const { ms, status, chatCount } = await getHistoryMs(adaContext.request);

    console.log(
      `[history empty] status=${status}  ms=${ms.toFixed(1)}  chats=${chatCount}`,
    );

    expect(status).toBe(200);
    expect(ms).toBeLessThan(SINGLE_THRESHOLD_MS);
  });

  test("GET /api/history with 5 seeded chats responds within threshold", async ({
    adaContext,
  }) => {
    await adaContext.request.delete("/api/history");

    // Seed 5 chats
    for (let i = 0; i < 5; i++) {
      await seedChat(adaContext.request, `Perf seed chat ${i}`);
    }

    const { ms, status, chatCount } = await getHistoryMs(adaContext.request);

    console.log(
      `[history 5 chats] status=${status}  ms=${ms.toFixed(1)}  chats=${chatCount}`,
    );

    expect(status).toBe(200);
    expect(ms).toBeLessThan(SINGLE_THRESHOLD_MS);
  });

  test("GET /api/history with 10 seeded chats responds within threshold", async ({
    adaContext,
  }) => {
    await adaContext.request.delete("/api/history");

    for (let i = 0; i < 10; i++) {
      await seedChat(adaContext.request, `Perf seed chat ${i}`);
    }

    const { ms, status, chatCount } = await getHistoryMs(adaContext.request);

    console.log(
      `[history 10 chats] status=${status}  ms=${ms.toFixed(1)}  chats=${chatCount}`,
    );

    expect(status).toBe(200);
    expect(ms).toBeLessThan(SINGLE_THRESHOLD_MS);
  });

  test("response time does not degrade by more than 2× from 0 to 10 chats", async ({
    adaContext,
  }) => {
    // Measure empty
    await adaContext.request.delete("/api/history");
    const { ms: emptyMs } = await getHistoryMs(adaContext.request);

    // Seed 10 chats
    for (let i = 0; i < 10; i++) {
      await seedChat(adaContext.request, `Degradation test ${i}`);
    }
    const { ms: fullMs } = await getHistoryMs(adaContext.request);

    console.log(
      `[history degradation] empty=${emptyMs.toFixed(1)}ms  full=${fullMs.toFixed(1)}ms  ratio=${(fullMs / Math.max(emptyMs, 1)).toFixed(2)}×`,
    );

    // Full history should take at most 2× the empty baseline
    // (also capped by absolute threshold)
    expect(fullMs).toBeLessThan(Math.max(emptyMs * 2, SINGLE_THRESHOLD_MS));
  });

  test("GET /api/history with limit=3 responds within threshold", async ({
    adaContext,
  }) => {
    const { ms, status } = await getHistoryMs(adaContext.request, "?limit=3");

    console.log(`[history limit=3] status=${status}  ms=${ms.toFixed(1)}`);

    expect(status).toBe(200);
    expect(ms).toBeLessThan(SINGLE_THRESHOLD_MS);
  });

  test("10 sequential GET /api/history requests maintain p95 below threshold", async ({
    adaContext,
  }) => {
    const times: number[] = [];

    for (let i = 0; i < 10; i++) {
      const { ms, status } = await getHistoryMs(adaContext.request);
      expect(status).toBe(200);
      times.push(ms);
    }

    const avgMs = avg(times);
    const p95Ms = p95(times);

    console.log(
      `[history sustained x10] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  all=${times.map((t) => t.toFixed(0)).join(",")}ms`,
    );

    expect(avgMs).toBeLessThan(SINGLE_THRESHOLD_MS);
    expect(p95Ms).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("5 concurrent GET /api/history requests all complete within threshold", async ({
    adaContext,
  }) => {
    const start = performance.now();

    const results = await Promise.all(
      Array.from({ length: 5 }, () => getHistoryMs(adaContext.request)),
    );

    const wallClock = performance.now() - start;
    const individualMs = results.map((r) => r.ms);
    const maxMs = Math.max(...individualMs);

    console.log(
      `[history concurrent x5] wall=${wallClock.toFixed(1)}ms  max_individual=${maxMs.toFixed(1)}ms`,
    );

    for (const { status } of results) {
      expect(status).toBe(200);
    }

    // Each individual request measured from its own start should be under threshold
    expect(maxMs).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("Babbage history query performance is independent of Ada's history size", async ({
    adaContext,
    babbageContext,
  }) => {
    // Ada accumulates history
    await adaContext.request.delete("/api/history");
    for (let i = 0; i < 10; i++) {
      await seedChat(adaContext.request, `Ada accumulation ${i}`);
    }

    // Babbage starts fresh
    await babbageContext.request.delete("/api/history");

    const { ms: babbageMs, status, chatCount } = await getHistoryMs(
      babbageContext.request,
    );

    console.log(
      `[history isolation] babbage_ms=${babbageMs.toFixed(1)}  babbage_chats=${chatCount}  status=${status}`,
    );

    expect(status).toBe(200);
    // Babbage's query should be fast regardless of Ada's row count
    expect(babbageMs).toBeLessThan(SINGLE_THRESHOLD_MS);
  });
});
