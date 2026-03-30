import { generateUUID } from "@/lib/utils";
import { expect, test } from "./fixtures";

/**
 * Performance tests — encryption throughput (via agent-config API round-trips)
 *
 * The encryption library (AES-256-GCM) is exercised every time an agent
 * configuration with an API key is saved or retrieved.  These tests measure
 * the overhead of encrypt-on-write / decrypt-on-read by timing the
 * POST (encrypt) and GET (decrypt) paths of /api/user_dashboard/agent-config.
 *
 * We also measure bulk throughput by performing N save+read cycles and
 * computing average and p95 latencies for each leg.
 *
 * Thresholds (ms) — localhost, ENCRYPTION_SECRET configured:
 *   Single POST (encrypt path)  < 400 ms
 *   Single GET  (decrypt path)  < 300 ms
 *   p95 over 10 cycles          < 600 ms per leg
 *
 * ENCRYPTION_SECRET must be set in .env.local (>= 32 chars) for these
 * tests to exercise the real encrypt/decrypt path.  Without it the route
 * returns empty config and the tests still pass but measure a no-op path.
 */

const POST_THRESHOLD_MS = 400;
const GET_THRESHOLD_MS  = 300;
const P95_THRESHOLD_MS  = 600;

/** A realistic agent config payload with an API key to encrypt */
function agentConfigPayload(agentId: string) {
  return {
    agentId,
    deploymentType: "cloud",
    provider: "openai",
    modelId: "gpt-4o",
    apiKey: "sk-perf-test-key-0000000000000000000000000000000000000000",
    agentSecrets: {
      OPENAI_API_KEY: "sk-perf-test-key-0000000000000000000000000000000000000000",
      SOME_OTHER_SECRET: "super-secret-value-for-performance-testing",
    },
  };
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? sorted[sorted.length - 1];
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

test.describe("Encryption throughput — agent-config API", () => {
  test("single POST (encrypt path) completes within threshold", async ({
    adaContext,
  }) => {
    const agentId = `perf-enc-${generateUUID()}`;
    const t0 = performance.now();

    const res = await adaContext.request.post(
      "/api/user_dashboard/agent-config",
      { data: agentConfigPayload(agentId) },
    );

    const ms = performance.now() - t0;

    console.log(
      `[enc POST single] status=${res.status()}  ms=${ms.toFixed(1)}`,
    );

    // 200 or 201 both acceptable
    expect(res.status()).toBeLessThan(300);
    expect(ms).toBeLessThan(POST_THRESHOLD_MS);
  });

  test("single GET (decrypt path) completes within threshold", async ({
    adaContext,
  }) => {
    const agentId = `perf-enc-${generateUUID()}`;

    // Seed a config to decrypt
    await adaContext.request.post("/api/user_dashboard/agent-config", {
      data: agentConfigPayload(agentId),
    });

    const t0 = performance.now();
    const res = await adaContext.request.get(
      `/api/user_dashboard/agent-config?agentId=${agentId}`,
    );
    const ms = performance.now() - t0;

    console.log(
      `[enc GET single] status=${res.status()}  ms=${ms.toFixed(1)}`,
    );

    expect(res.status()).toBe(200);
    expect(ms).toBeLessThan(GET_THRESHOLD_MS);
  });

  test("10 sequential POST (encrypt) operations maintain p95 below threshold", async ({
    adaContext,
  }) => {
    const postTimes: number[] = [];

    for (let i = 0; i < 10; i++) {
      const agentId = `perf-enc-bulk-${generateUUID()}`;
      const t0 = performance.now();
      const res = await adaContext.request.post(
        "/api/user_dashboard/agent-config",
        { data: agentConfigPayload(agentId) },
      );
      const ms = performance.now() - t0;
      expect(res.status()).toBeLessThan(300);
      postTimes.push(ms);
    }

    const avgMs = avg(postTimes);
    const p95Ms = p95(postTimes);

    console.log(
      `[enc POST x10] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  all=${postTimes.map((t) => t.toFixed(0)).join(",")}ms`,
    );

    expect(avgMs).toBeLessThan(POST_THRESHOLD_MS);
    expect(p95Ms).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("10 sequential GET (decrypt) operations maintain p95 below threshold", async ({
    adaContext,
  }) => {
    // Seed one config — read it 10 times
    const agentId = `perf-enc-read-${generateUUID()}`;
    await adaContext.request.post("/api/user_dashboard/agent-config", {
      data: agentConfigPayload(agentId),
    });

    const getTimes: number[] = [];

    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      const res = await adaContext.request.get(
        `/api/user_dashboard/agent-config?agentId=${agentId}`,
      );
      const ms = performance.now() - t0;
      expect(res.status()).toBe(200);
      getTimes.push(ms);
    }

    const avgMs = avg(getTimes);
    const p95Ms = p95(getTimes);

    console.log(
      `[enc GET x10] avg=${avgMs.toFixed(1)}ms  p95=${p95Ms.toFixed(1)}ms  all=${getTimes.map((t) => t.toFixed(0)).join(",")}ms`,
    );

    expect(avgMs).toBeLessThan(GET_THRESHOLD_MS);
    expect(p95Ms).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("full save-then-read cycle (encrypt + decrypt) completes within combined threshold", async ({
    adaContext,
  }) => {
    const agentId = `perf-enc-cycle-${generateUUID()}`;

    const t0 = performance.now();

    const postRes = await adaContext.request.post(
      "/api/user_dashboard/agent-config",
      { data: agentConfigPayload(agentId) },
    );
    const postMs = performance.now() - t0;

    const t1 = performance.now();
    const getRes = await adaContext.request.get(
      `/api/user_dashboard/agent-config?agentId=${agentId}`,
    );
    const getMs = performance.now() - t1;

    const totalMs = postMs + getMs;

    console.log(
      `[enc cycle] post=${postMs.toFixed(1)}ms  get=${getMs.toFixed(1)}ms  total=${totalMs.toFixed(1)}ms`,
    );

    expect(postRes.status()).toBeLessThan(300);
    expect(getRes.status()).toBe(200);
    expect(totalMs).toBeLessThan(POST_THRESHOLD_MS + GET_THRESHOLD_MS);
  });

  test("5 concurrent save operations complete within wall-clock threshold", async ({
    adaContext,
  }) => {
    const agentIds = Array.from({ length: 5 }, () => `perf-conc-${generateUUID()}`);

    const t0 = performance.now();
    const responses = await Promise.all(
      agentIds.map((agentId) =>
        adaContext.request.post("/api/user_dashboard/agent-config", {
          data: agentConfigPayload(agentId),
        }),
      ),
    );
    const wallMs = performance.now() - t0;

    console.log(`[enc concurrent POST x5] wall=${wallMs.toFixed(1)}ms`);

    for (const res of responses) {
      expect(res.status()).toBeLessThan(300);
    }

    // All 5 concurrent encryptions within 2000 ms wall-clock
    expect(wallMs).toBeLessThan(2000);
  });

  test("DELETE then re-save cycle does not introduce extra encryption latency", async ({
    adaContext,
  }) => {
    const agentId = `perf-enc-redel-${generateUUID()}`;

    // First save
    await adaContext.request.post("/api/user_dashboard/agent-config", {
      data: agentConfigPayload(agentId),
    });

    // Delete
    await adaContext.request.delete(
      `/api/user_dashboard/agent-config?agentId=${agentId}`,
    );

    // Re-save and measure
    const t0 = performance.now();
    const res = await adaContext.request.post(
      "/api/user_dashboard/agent-config",
      { data: agentConfigPayload(agentId) },
    );
    const ms = performance.now() - t0;

    console.log(
      `[enc re-save after delete] status=${res.status()}  ms=${ms.toFixed(1)}`,
    );

    expect(res.status()).toBeLessThan(300);
    expect(ms).toBeLessThan(POST_THRESHOLD_MS);
  });
});
