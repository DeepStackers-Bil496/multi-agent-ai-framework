import { expect, test } from "../fixtures";
import type { ExecutionStep } from "@/lib/types";
import {
  createIsolatedUserContext,
  createOwnedDocument,
  expectGuestRedirect,
  seedExecutionChatForUser,
} from "./utils";

const seededSteps: ExecutionStep[] = [
  {
    id: "agent-1",
    type: "agent",
    name: "Main Agent",
    status: "completed",
    startTime: 1_710_000_000_000,
    endTime: 1_710_000_000_500,
    children: [
      {
        id: "tool-1",
        type: "tool",
        name: "Main Agent_search_web",
        status: "completed",
        startTime: 1_710_000_000_100,
        endTime: 1_710_000_000_200,
        children: [],
      },
    ],
  },
];

test.describe("/api/agents_dashboard/metrics", () => {
  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get("/api/agents_dashboard/metrics", {
      maxRedirects: 0,
    });

    expectGuestRedirect(response);
  });

  test("fresh user receives empty metrics", async ({ browser }) => {
    const isolated = await createIsolatedUserContext(browser, "metrics-empty");

    try {
      const response = await isolated.request.get("/api/agents_dashboard/metrics");
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({
        summary: {
          totalAgentCalls: 0,
          totalToolCalls: 0,
          totalErrors: 0,
          avgLatencyMs: 0,
          activeAgents: 0,
        },
        agentMetrics: [],
        recentEvents: [],
        recentExecutions: [],
      });
    } finally {
      await isolated.context.close();
    }
  });

  test("execution data is aggregated into metrics", async ({ browser }) => {
    const isolated = await createIsolatedUserContext(browser, "metrics-seeded");

    try {
      const document = await createOwnedDocument(isolated.request, {
        title: "Metrics Ownership Probe",
      });

      const chatId = await seedExecutionChatForUser({
        userId: document.userId,
        title: "Metrics Seed Chat",
        steps: seededSteps,
      });

      const response = await isolated.request.get("/api/agents_dashboard/metrics");
      expect(response.status()).toBe(200);

      const payload = await response.json();
      expect(payload.summary).toEqual({
        totalAgentCalls: 1,
        totalToolCalls: 1,
        totalErrors: 0,
        avgLatencyMs: 500,
        activeAgents: 1,
      });
      expect(payload.agentMetrics).toHaveLength(1);
      expect(payload.agentMetrics[0]).toMatchObject({
        agentId: "main-agent",
        agentName: "Main Agent",
        totalCalls: 1,
        totalToolCalls: 1,
        errorCount: 0,
      });
      expect(payload.recentEvents).toHaveLength(2);
      expect(payload.recentExecutions).toHaveLength(1);
      expect(payload.recentExecutions[0].chatId).toBe(chatId);
    } finally {
      await isolated.context.close();
    }
  });

  test("metrics are isolated per user", async ({ browser }) => {
    const ada = await createIsolatedUserContext(browser, "metrics-ada");
    const babbage = await createIsolatedUserContext(browser, "metrics-babbage");

    try {
      const document = await createOwnedDocument(ada.request);
      await seedExecutionChatForUser({
        userId: document.userId,
        title: "Ada Metrics Chat",
        steps: seededSteps,
      });

      const adaResponse = await ada.request.get("/api/agents_dashboard/metrics");
      const babbageResponse = await babbage.request.get(
        "/api/agents_dashboard/metrics"
      );

      expect((await adaResponse.json()).summary.totalAgentCalls).toBe(1);
      expect(await babbageResponse.json()).toEqual({
        summary: {
          totalAgentCalls: 0,
          totalToolCalls: 0,
          totalErrors: 0,
          avgLatencyMs: 0,
          activeAgents: 0,
        },
        agentMetrics: [],
        recentEvents: [],
        recentExecutions: [],
      });
    } finally {
      await ada.context.close();
      await babbage.context.close();
    }
  });
});
