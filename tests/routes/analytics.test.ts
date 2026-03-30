import { expect, test } from "./fixtures";
import {
  createIsolatedUserContext,
  createOwnedDocument,
  expectGuestRedirect,
  seedChatForUser,
} from "./utils";

test.describe("/api/user_dashboard/analytics", () => {
  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get("/api/user_dashboard/analytics", {
      maxRedirects: 0,
    });

    expectGuestRedirect(response);
  });

  test("fresh user receives empty analytics", async ({ browser }) => {
    const isolated = await createIsolatedUserContext(browser, "analytics-empty");

    try {
      const response = await isolated.request.get("/api/user_dashboard/analytics");
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({
        summary: {
          totalChats: 0,
          totalMessages: 0,
          totalTokens: 0,
        },
        recentChats: [],
        messagesPerDay: [],
      });
    } finally {
      await isolated.context.close();
    }
  });

  test("seeded chats and messages appear in analytics", async ({ browser }) => {
    const isolated = await createIsolatedUserContext(browser, "analytics-seeded");

    try {
      const document = await createOwnedDocument(isolated.request, {
        title: "Analytics Ownership Probe",
      });

      await seedChatForUser({
        userId: document.userId,
        title: "Analytics Seed Chat",
        lastContext: {
          totalTokens: 123,
          inputTokens: 45,
          outputTokens: 78,
        },
      });

      const response = await isolated.request.get("/api/user_dashboard/analytics");
      expect(response.status()).toBe(200);

      const payload = await response.json();
      expect(payload.summary.totalChats).toBe(1);
      expect(payload.summary.totalMessages).toBe(2);
      expect(payload.summary.totalTokens).toBe(123);
      expect(payload.recentChats).toHaveLength(1);
      expect(payload.recentChats[0].title).toBe("Analytics Seed Chat");
      expect(
        payload.messagesPerDay.reduce(
          (sum: number, item: { count: number }) => sum + item.count,
          0
        )
      ).toBe(2);
    } finally {
      await isolated.context.close();
    }
  });

  test("analytics are isolated per user", async ({ browser }) => {
    const ada = await createIsolatedUserContext(browser, "analytics-ada");
    const babbage = await createIsolatedUserContext(browser, "analytics-babbage");

    try {
      const document = await createOwnedDocument(ada.request);
      await seedChatForUser({
        userId: document.userId,
        title: "Ada Analytics Chat",
        lastContext: {
          totalTokens: 50,
          inputTokens: 20,
          outputTokens: 30,
        },
      });

      const adaResponse = await ada.request.get("/api/user_dashboard/analytics");
      const babbageResponse = await babbage.request.get(
        "/api/user_dashboard/analytics"
      );

      expect((await adaResponse.json()).summary.totalChats).toBe(1);
      expect(await babbageResponse.json()).toEqual({
        summary: {
          totalChats: 0,
          totalMessages: 0,
          totalTokens: 0,
        },
        recentChats: [],
        messagesPerDay: [],
      });
    } finally {
      await ada.context.close();
      await babbage.context.close();
    }
  });
});
