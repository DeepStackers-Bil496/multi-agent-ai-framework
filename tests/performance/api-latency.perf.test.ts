import { generateUUID } from "@/lib/utils";
import { expect, test } from "./fixtures";

/**
 * Performance tests — API route latency under load
 *
 * These tests measure wall-clock response times for the core API routes
 * under sequential and concurrent request patterns.
 *
 * Thresholds (ms) are intentionally generous to avoid flakiness on
 * developer machines; tighten them in CI once baseline is established.
 *
 * PLAYWRIGHT=true must be set so the mock agent is used — real LLM calls
 * would dominate latency and make thresholds meaningless.
 *
 * All tests use adaContext.request so the session cookie is sent with
 * every request (auth overhead is not part of what we are measuring).
 */

/** Measure elapsed ms for a single async operation */
async function time<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - start };
}

/** Run fn N times sequentially; return array of elapsed ms */
async function timeN(fn: () => Promise<unknown>, n: number): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const { ms } = await time(fn);
    times.push(ms);
  }
  return times;
}

/** Run fn N times concurrently; return array of elapsed ms */
async function timeConcurrent(
  fn: () => Promise<unknown>,
  n: number,
): Promise<number[]> {
  const promises = Array.from({ length: n }, () => time(fn));
  const results = await Promise.all(promises);
  return results.map((r) => r.ms);
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)];
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────
const THRESHOLDS = {
  historyGet:        { avg: 300,  p95: 700  }, // ms
  preferencesGet:    { avg: 300,  p95: 800  },
  agentConfigGet:    { avg: 350,  p95: 1500 },
  concurrentHistory: { avg: 800,  p95: 1200 }, // 5 concurrent on Next dev server
};

test.describe("API route latency — sequential", () => {
  test.beforeAll(async ({ adaContext }) => {
    await adaContext.request.get("/api/history");
    await adaContext.request.get("/api/user_dashboard/preferences");
    await adaContext.request.get(
      "/api/user_dashboard/agent-config?agentId=main-agent",
    );
  });

  test("GET /api/history responds within threshold for 10 sequential requests", async ({
    adaContext,
  }) => {
    await adaContext.request.get("/api/history");

    const times = await timeN(
      () => adaContext.request.get("/api/history"),
      10,
    );

    const avgMs = avg(times);
    const p95Ms = p95(times);

    console.log(
      `[history] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  samples=${times.length}`,
    );

    expect(avgMs).toBeLessThan(THRESHOLDS.historyGet.avg);
    expect(p95Ms).toBeLessThan(THRESHOLDS.historyGet.p95);
  });

  test("GET /api/user_dashboard/preferences responds within threshold for 10 sequential requests", async ({
    adaContext,
  }) => {
    await adaContext.request.get("/api/user_dashboard/preferences");

    const times = await timeN(
      () => adaContext.request.get("/api/user_dashboard/preferences"),
      10,
    );

    const avgMs = avg(times);
    const p95Ms = p95(times);

    console.log(
      `[preferences] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  samples=${times.length}`,
    );

    expect(avgMs).toBeLessThan(THRESHOLDS.preferencesGet.avg);
    expect(p95Ms).toBeLessThan(THRESHOLDS.preferencesGet.p95);
  });

  test("GET /api/user_dashboard/agent-config responds within threshold for 10 sequential requests", async ({
    adaContext,
  }) => {
    const agentId = "main-agent";
    await adaContext.request.get(
      `/api/user_dashboard/agent-config?agentId=${agentId}`,
    );

    const times = await timeN(
      () =>
        adaContext.request.get(
          `/api/user_dashboard/agent-config?agentId=${agentId}`,
        ),
      10,
    );

    const avgMs = avg(times);
    const p95Ms = p95(times);

    console.log(
      `[agent-config] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  samples=${times.length}`,
    );

    expect(avgMs).toBeLessThan(THRESHOLDS.agentConfigGet.avg);
    expect(p95Ms).toBeLessThan(THRESHOLDS.agentConfigGet.p95);
  });
});

test.describe("API route latency — concurrent", () => {
  test("GET /api/history handles 5 concurrent requests within threshold", async ({
    adaContext,
  }) => {
    await adaContext.request.get("/api/history");

    const times = await timeConcurrent(
      () => adaContext.request.get("/api/history"),
      5,
    );

    const avgMs = avg(times);
    const p95Ms = p95(times);

    console.log(
      `[history concurrent] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  samples=${times.length}`,
    );

    expect(avgMs).toBeLessThan(THRESHOLDS.concurrentHistory.avg);
    expect(p95Ms).toBeLessThan(THRESHOLDS.concurrentHistory.p95);
  });

  test("GET /api/user_dashboard/preferences handles 5 concurrent requests within threshold", async ({
    adaContext,
  }) => {
    await adaContext.request.get("/api/user_dashboard/preferences");

    const times = await timeConcurrent(
      () => adaContext.request.get("/api/user_dashboard/preferences"),
      5,
    );

    const avgMs = avg(times);
    const p95Ms = p95(times);

    console.log(
      `[preferences concurrent] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  samples=${times.length}`,
    );

    // Reuse concurrentHistory threshold — same DB tier
    expect(avgMs).toBeLessThan(THRESHOLDS.concurrentHistory.avg);
    expect(p95Ms).toBeLessThan(THRESHOLDS.concurrentHistory.p95);
  });

  test("mixed concurrent requests across 3 different routes complete within threshold", async ({
    adaContext,
  }) => {
    const agentId = "main-agent";

    const start = performance.now();
    await Promise.all([
      adaContext.request.get("/api/history"),
      adaContext.request.get("/api/user_dashboard/preferences"),
      adaContext.request.get(
        `/api/user_dashboard/agent-config?agentId=${agentId}`,
      ),
      adaContext.request.get("/api/history"),
      adaContext.request.get("/api/user_dashboard/preferences"),
    ]);
    const totalMs = performance.now() - start;

    console.log(
      `[mixed concurrent] wall-clock=${totalMs.toFixed(1)}ms for 5 mixed requests`,
    );

    // All 5 requests should complete within 1500 ms wall-clock
    expect(totalMs).toBeLessThan(1500);
  });
});

test.describe("API route latency — POST operations", () => {
  test("POST /api/user_dashboard/preferences responds within threshold", async ({
    adaContext,
  }) => {
    const times = await timeN(
      () =>
        adaContext.request.post("/api/user_dashboard/preferences", {
          data: { agentId: `perf-agent-${generateUUID()}`, enabled: true },
        }),
      5,
    );

    const avgMs = avg(times);
    const p95Ms = p95(times);

    console.log(
      `[preferences POST] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  samples=${times.length}`,
    );

    expect(avgMs).toBeLessThan(500);
    expect(p95Ms).toBeLessThan(800);
  });

  test("DELETE /api/history responds within threshold", async ({
    adaContext,
  }) => {
    const { ms } = await time(() => adaContext.request.delete("/api/history"));

    console.log(`[history DELETE] ${ms.toFixed(1)}ms`);

    expect(ms).toBeLessThan(1000);
  });
});
