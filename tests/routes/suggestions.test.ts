import { expect, test } from "../fixtures";
import { createOwnedDocument, expectGuestRedirect, seedDocumentSuggestion } from "./utils";
import { generateUUID } from "@/lib/utils";

test.describe("/api/suggestions", () => {
  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get(
      `/api/suggestions?documentId=${generateUUID()}`,
      { maxRedirects: 0 }
    );

    expectGuestRedirect(response);
  });

  test("documentId query parameter is required", async ({ adaContext }) => {
    const response = await adaContext.request.get("/api/suggestions");

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(payload.cause).toBe("Parameter documentId is required.");
  });

  test("returns an empty array when no suggestions exist", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get(
      `/api/suggestions?documentId=${generateUUID()}`
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("owner can retrieve suggestions for a document", async ({ adaContext }) => {
    const document = await createOwnedDocument(adaContext.request);
    const seeded = await seedDocumentSuggestion({
      document,
      userId: document.userId,
    });

    const response = await adaContext.request.get(
      `/api/suggestions?documentId=${document.id}`
    );

    expect(response.status()).toBe(200);
    const suggestions = await response.json();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      id: seeded.id,
      documentId: document.id,
      originalText: seeded.originalText,
      suggestedText: seeded.suggestedText,
      userId: document.userId,
    });
  });

  test("another user cannot retrieve the owner's suggestions", async ({
    adaContext,
    babbageContext,
  }) => {
    const document = await createOwnedDocument(adaContext.request);
    await seedDocumentSuggestion({
      document,
      userId: document.userId,
    });

    const response = await babbageContext.request.get(
      `/api/suggestions?documentId=${document.id}`
    );

    expect(response.status()).toBe(403);
    const payload = await response.json();
    expect(payload.code).toBe("forbidden:api");
  });
});
