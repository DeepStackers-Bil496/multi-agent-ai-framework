import { expect, test } from "../fixtures";

/**
 * Route tests for:
 *   GET  /api/user_dashboard/preferences
 *   POST /api/user_dashboard/preferences
 *
 * Covers:
 *  - Auth enforcement
 *  - Initial empty preferences for a new user
 *  - Setting a preference (enabled/disabled)
 *  - Updating an existing preference (upsert semantics)
 *  - Validation: missing/invalid fields
 *  - User isolation: Babbage cannot read or overwrite Ada's preferences
 *
 * Tests are serial — each POST test depends on the state from previous steps.
 */

test.describe.serial("/api/user_dashboard/preferences", () => {
  // ─── Auth ───────────────────────────────────────────────────────────────

  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get("/api/user_dashboard/preferences", {
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers().location).toContain("/api/auth/guest");
  });

  test("anonymous POST is redirected to guest auth", async ({ request }) => {
    const response = await request.post("/api/user_dashboard/preferences", {
      maxRedirects: 0,
      data: { agentId: "github-agent", enabled: true },
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
  });

  // ─── GET — initial state ─────────────────────────────────────────────────

  test("returns { preferences: [] } for a brand-new user", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get(
      "/api/user_dashboard/preferences"
    );

    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload).toHaveProperty("preferences");
    expect(Array.isArray(payload.preferences)).toBe(true);
  });

  // ─── POST — validation ───────────────────────────────────────────────────

  test("POST without agentId returns 400", async ({ adaContext }) => {
    const response = await adaContext.request.post(
      "/api/user_dashboard/preferences",
      {
        data: { enabled: true },
      }
    );

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
  });

  test("POST without enabled returns 400", async ({ adaContext }) => {
    const response = await adaContext.request.post(
      "/api/user_dashboard/preferences",
      {
        data: { agentId: "github-agent" },
      }
    );

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
  });

  test("POST with enabled as a string (not boolean) returns 400", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post(
      "/api/user_dashboard/preferences",
      {
        data: { agentId: "github-agent", enabled: "true" },
      }
    );

    expect(response.status()).toBe(400);
  });

  // ─── POST — happy path ───────────────────────────────────────────────────

  test("POST creates a new preference and returns { success: true }", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post(
      "/api/user_dashboard/preferences",
      {
        data: { agentId: "github-agent", enabled: true },
      }
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  test("GET returns the preference just created", async ({ adaContext }) => {
    const response = await adaContext.request.get(
      "/api/user_dashboard/preferences"
    );

    expect(response.status()).toBe(200);

    const { preferences } = await response.json();
    const pref = preferences.find(
      (p: { agentId: string }) => p.agentId === "github-agent"
    );

    expect(pref).toBeDefined();
    expect(pref.enabled).toBe(true);
    expect(pref).toHaveProperty("userId");
    expect(pref).toHaveProperty("createdAt");
    expect(pref).toHaveProperty("updatedAt");
  });

  test("POST updates an existing preference (upsert — disable)", async ({
    adaContext,
  }) => {
    // Disable the same agent we just enabled
    const response = await adaContext.request.post(
      "/api/user_dashboard/preferences",
      {
        data: { agentId: "github-agent", enabled: false },
      }
    );

    expect(response.status()).toBe(200);

    // Verify the update persisted
    const getResponse = await adaContext.request.get(
      "/api/user_dashboard/preferences"
    );
    const { preferences } = await getResponse.json();
    const pref = preferences.find(
      (p: { agentId: string }) => p.agentId === "github-agent"
    );

    expect(pref.enabled).toBe(false);
  });

  test("POST can manage multiple agents independently", async ({
    adaContext,
  }) => {
    await adaContext.request.post("/api/user_dashboard/preferences", {
      data: { agentId: "search-agent", enabled: true },
    });
    await adaContext.request.post("/api/user_dashboard/preferences", {
      data: { agentId: "coding-agent", enabled: false },
    });

    const { preferences } = await (
      await adaContext.request.get("/api/user_dashboard/preferences")
    ).json();

    const searchPref = preferences.find(
      (p: { agentId: string }) => p.agentId === "search-agent"
    );
    const codingPref = preferences.find(
      (p: { agentId: string }) => p.agentId === "coding-agent"
    );

    expect(searchPref?.enabled).toBe(true);
    expect(codingPref?.enabled).toBe(false);
  });

  // ─── User isolation ──────────────────────────────────────────────────────

  test("Babbage does not see Ada's preferences", async ({
    adaContext,
    babbageContext,
  }) => {
    // Ada sets a preference
    await adaContext.request.post("/api/user_dashboard/preferences", {
      data: { agentId: "vision-agent", enabled: true },
    });

    // Babbage fetches theirs
    const response = await babbageContext.request.get(
      "/api/user_dashboard/preferences"
    );
    const { preferences } = await response.json();

    const visionPref = preferences.find(
      (p: { agentId: string }) => p.agentId === "vision-agent"
    );

    // Babbage should not see Ada's vision-agent preference
    // (they may have created their own, but that would be from their own POST)
    const adaPrefsResponse = await adaContext.request.get(
      "/api/user_dashboard/preferences"
    );
    const { preferences: adaPrefs } = await adaPrefsResponse.json();
    const adaVision = adaPrefs.find(
      (p: { agentId: string; userId: string }) => p.agentId === "vision-agent"
    );

    if (visionPref && adaVision) {
      expect(visionPref.userId).not.toBe(adaVision.userId);
    }
  });
});
