import { expect, test } from "../fixtures";
import { createIsolatedUserContext, expectGuestRedirect } from "./utils";

test.describe("/api/settings/notifications", () => {
  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get("/api/settings/notifications", {
      maxRedirects: 0,
    });

    expectGuestRedirect(response);
  });

  test("anonymous PUT is redirected to guest auth", async ({ request }) => {
    const response = await request.put("/api/settings/notifications", {
      maxRedirects: 0,
      data: { notifyEmails: true },
    });

    expectGuestRedirect(response);
  });

  test("fresh user receives default notification preferences", async ({
    browser,
  }) => {
    const isolated = await createIsolatedUserContext(
      browser,
      "notifications-default"
    );

    try {
      const response = await isolated.request.get("/api/settings/notifications");
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({
        notifications: {
          notifyResponseCompletions: true,
          notifyEmails: false,
        },
      });
    } finally {
      await isolated.context.close();
    }
  });

  test("PUT rejects invalid notification fields", async ({ browser }) => {
    const isolated = await createIsolatedUserContext(
      browser,
      "notifications-invalid"
    );

    try {
      const response = await isolated.request.put("/api/settings/notifications", {
        data: { notifyEmails: "yes" },
      });

      expect(response.status()).toBe(400);
      const payload = await response.json();
      expect(payload.code).toBe("bad_request:api");
      expect(typeof payload.message).toBe("string");
    } finally {
      await isolated.context.close();
    }
  });

  test("PUT saves and GET returns notification preferences", async ({
    browser,
  }) => {
    const isolated = await createIsolatedUserContext(
      browser,
      "notifications-save"
    );

    try {
      const saveResponse = await isolated.request.put("/api/settings/notifications", {
        data: {
          notifyResponseCompletions: false,
          notifyEmails: true,
        },
      });

      expect(saveResponse.status()).toBe(200);
      expect(await saveResponse.json()).toEqual({
        notifications: {
          notifyResponseCompletions: false,
          notifyEmails: true,
        },
      });

      const getResponse = await isolated.request.get("/api/settings/notifications");
      expect(getResponse.status()).toBe(200);
      expect(await getResponse.json()).toEqual({
        notifications: {
          notifyResponseCompletions: false,
          notifyEmails: true,
        },
      });
    } finally {
      await isolated.context.close();
    }
  });

  test("notification preferences are isolated per user", async ({ browser }) => {
    const ada = await createIsolatedUserContext(browser, "notifications-ada");
    const babbage = await createIsolatedUserContext(
      browser,
      "notifications-babbage"
    );

    try {
      await ada.request.put("/api/settings/notifications", {
        data: {
          notifyResponseCompletions: false,
          notifyEmails: true,
        },
      });

      const adaResponse = await ada.request.get("/api/settings/notifications");
      const babbageResponse = await babbage.request.get(
        "/api/settings/notifications"
      );

      expect(await adaResponse.json()).toEqual({
        notifications: {
          notifyResponseCompletions: false,
          notifyEmails: true,
        },
      });
      expect(await babbageResponse.json()).toEqual({
        notifications: {
          notifyResponseCompletions: true,
          notifyEmails: false,
        },
      });
    } finally {
      await ada.context.close();
      await babbage.context.close();
    }
  });
});
