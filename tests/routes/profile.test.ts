import { expect, test } from "../fixtures";
import { createIsolatedUserContext, expectGuestRedirect } from "./utils";

test.describe("/api/settings/profile", () => {
  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get("/api/settings/profile", {
      maxRedirects: 0,
    });

    expectGuestRedirect(response);
  });

  test("anonymous PUT is redirected to guest auth", async ({ request }) => {
    const response = await request.put("/api/settings/profile", {
      maxRedirects: 0,
      data: { fullName: "Guest" },
    });

    expectGuestRedirect(response);
  });

  test("fresh user receives null profile", async ({ browser }) => {
    const isolated = await createIsolatedUserContext(browser, "profile-get");

    try {
      const response = await isolated.request.get("/api/settings/profile");
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ profile: null });
    } finally {
      await isolated.context.close();
    }
  });

  test("PUT rejects invalid profile fields", async ({ browser }) => {
    const isolated = await createIsolatedUserContext(browser, "profile-invalid");

    try {
      const response = await isolated.request.put("/api/settings/profile", {
        data: { fullName: 123 },
      });

      expect(response.status()).toBe(400);

      const payload = await response.json();
      expect(payload.code).toBe("bad_request:api");
      expect(typeof payload.message).toBe("string");
    } finally {
      await isolated.context.close();
    }
  });

  test("PUT saves and GET returns the profile", async ({ browser }) => {
    const isolated = await createIsolatedUserContext(browser, "profile-save");

    try {
      const saveResponse = await isolated.request.put("/api/settings/profile", {
        data: {
          fullName: "Ada Lovelace",
          nickname: "ada",
          workType: "research",
          personalPreferences: "Prefer concise technical summaries",
        },
      });

      expect(saveResponse.status()).toBe(200);
      expect(await saveResponse.json()).toEqual({
        profile: {
          fullName: "Ada Lovelace",
          nickname: "ada",
          workType: "research",
          personalPreferences: "Prefer concise technical summaries",
        },
      });

      const getResponse = await isolated.request.get("/api/settings/profile");
      expect(getResponse.status()).toBe(200);
      expect(await getResponse.json()).toEqual({
        profile: {
          fullName: "Ada Lovelace",
          nickname: "ada",
          workType: "research",
          personalPreferences: "Prefer concise technical summaries",
        },
      });
    } finally {
      await isolated.context.close();
    }
  });

  test("profiles are isolated per user", async ({ browser }) => {
    const ada = await createIsolatedUserContext(browser, "profile-ada");
    const babbage = await createIsolatedUserContext(browser, "profile-babbage");

    try {
      await ada.request.put("/api/settings/profile", {
        data: {
          fullName: "Ada Lovelace",
          nickname: "ada",
        },
      });

      const adaResponse = await ada.request.get("/api/settings/profile");
      const babbageResponse = await babbage.request.get("/api/settings/profile");

      expect((await adaResponse.json()).profile.fullName).toBe("Ada Lovelace");
      expect(await babbageResponse.json()).toEqual({ profile: null });
    } finally {
      await ada.context.close();
      await babbage.context.close();
    }
  });
});
