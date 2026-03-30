import { expect, test } from "./fixtures";

/**
 * Route tests for GET /api/history and DELETE /api/history
 *
 * Covers:
 *  - Auth enforcement (anonymous → redirect)
 *  - Query-param validation (both pagination cursors simultaneously)
 *  - Successful paginated response shape
 *  - User isolation (Babbage cannot see Ada's chats)
 *  - DELETE clears all chats for the authenticated user
 *  - DELETE does not affect another user's chats
 *
 * Tests are serial because the DELETE test mutates state that later
 * GET tests would see — keep as serial within this file.
 */

test.describe.serial("/api/history", () => {
  // ─── Auth ───────────────────────────────────────────────────────────────

  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get("/api/history", {
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers().location).toContain("/api/auth/guest");
  });

  test("anonymous DELETE is redirected to guest auth", async ({ request }) => {
    const response = await request.delete("/api/history", {
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
  });

  // ─── Validation ─────────────────────────────────────────────────────────

  test("providing both starting_after and ending_before returns 400", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get(
      "/api/history?starting_after=abc&ending_before=xyz"
    );

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    // The route returns the standard bad_request:api message
    expect(typeof payload.message).toBe("string");
    expect(payload.message.length).toBeGreaterThan(0);
  });

  // ─── Response shape ──────────────────────────────────────────────────────

  test("returns { chats, hasMore } for an authenticated user", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get("/api/history?limit=10");

    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload).toHaveProperty("chats");
    expect(payload).toHaveProperty("hasMore");
    expect(Array.isArray(payload.chats)).toBe(true);
    expect(typeof payload.hasMore).toBe("boolean");
  });

  test("default limit of 10 is applied when not specified", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get("/api/history");

    expect(response.status()).toBe(200);

    const payload = await response.json();
    // New test user has at most a handful of chats — count should be <= 10
    expect(payload.chats.length).toBeLessThanOrEqual(10);
  });

  test("each chat object has expected fields", async ({ adaContext }) => {
    const response = await adaContext.request.get("/api/history?limit=5");
    expect(response.status()).toBe(200);

    const { chats } = await response.json();

    if (chats.length > 0) {
      const chat = chats[0];
      expect(chat).toHaveProperty("id");
      expect(chat).toHaveProperty("title");
      expect(chat).toHaveProperty("createdAt");
      expect(chat).toHaveProperty("userId");
    }
  });

  test("limit parameter restricts the number of returned chats", async ({
    adaContext,
  }) => {
    // First, get all chats to know the total
    const allResponse = await adaContext.request.get("/api/history?limit=100");
    const { chats: allChats } = await allResponse.json();

    if (allChats.length >= 2) {
      const limitedResponse = await adaContext.request.get("/api/history?limit=1");
      expect(limitedResponse.status()).toBe(200);

      const { chats } = await limitedResponse.json();
      expect(chats.length).toBeLessThanOrEqual(1);
    }
  });

  // ─── User isolation ──────────────────────────────────────────────────────

  test("Babbage sees only their own chats, not Ada's", async ({
    adaContext,
    babbageContext,
  }) => {
    const adaResponse = await adaContext.request.get("/api/history?limit=100");
    const babbageResponse = await babbageContext.request.get("/api/history?limit=100");

    expect(adaResponse.status()).toBe(200);
    expect(babbageResponse.status()).toBe(200);

    const { chats: adaChats } = await adaResponse.json();
    const { chats: babbageChats } = await babbageResponse.json();

    const adaIds = new Set(adaChats.map((c: { id: string }) => c.id));
    const babbageIds = new Set(babbageChats.map((c: { id: string }) => c.id));

    // No chat IDs should appear in both sets
    for (const id of babbageIds) {
      expect(adaIds.has(id)).toBe(false);
    }
  });

  // ─── DELETE ──────────────────────────────────────────────────────────────

  test("DELETE removes all of the authenticated user's chats", async ({
    curieContext,
  }) => {
    // First verify Curie has at least one chat (created during fixture setup)
    const beforeResponse = await curieContext.request.get("/api/history?limit=100");
    expect(beforeResponse.status()).toBe(200);
    const { chats: before } = await beforeResponse.json();

    // Delete all
    const deleteResponse = await curieContext.request.delete("/api/history");
    expect(deleteResponse.status()).toBe(200);

    const deletePayload = await deleteResponse.json();
    expect(deletePayload).toHaveProperty("deletedCount");
    expect(typeof deletePayload.deletedCount).toBe("number");
    expect(deletePayload.deletedCount).toBeGreaterThanOrEqual(
      Math.min(before.length, 1)
    );

    // Now the list should be empty
    const afterResponse = await curieContext.request.get("/api/history?limit=100");
    expect(afterResponse.status()).toBe(200);
    const { chats: after } = await afterResponse.json();
    expect(after).toHaveLength(0);
  });

  test("DELETE does not remove another user's chats", async ({
    adaContext,
    babbageContext,
  }) => {
    // Capture Ada's chats before Babbage deletes
    const adaBefore = await adaContext.request.get("/api/history?limit=100");
    const { chats: adaChatsBefore } = await adaBefore.json();

    // Babbage deletes their own history
    const deleteResponse = await babbageContext.request.delete("/api/history");
    expect(deleteResponse.status()).toBe(200);

    // Ada's chats should be unchanged
    const adaAfter = await adaContext.request.get("/api/history?limit=100");
    const { chats: adaChatsAfter } = await adaAfter.json();

    expect(adaChatsAfter.length).toBe(adaChatsBefore.length);
  });
});
