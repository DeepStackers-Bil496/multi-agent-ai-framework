import { expect, test } from "../fixtures";
import {
  createIsolatedUserContext,
  createOwnedDocument,
  expectGuestRedirect,
} from "./utils";
import { generateUUID } from "@/lib/utils";

async function getDbQueries() {
  return import("@/lib/db/queries");
}

test.describe("/api/chat/[id]/stream", () => {
  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get(`/api/chat/${generateUUID()}/stream`, {
      maxRedirects: 0,
    });

    expectGuestRedirect(response);
  });

  test("returns 404 when the chat does not exist", async ({ adaContext }) => {
    const response = await adaContext.request.get(
      `/api/chat/${generateUUID()}/stream`
    );

    expect(response.status()).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("not_found:chat");
  });

  test("returns 404 when the chat exists but has no stream ids", async ({
    browser,
  }) => {
    const isolated = await createIsolatedUserContext(browser, "stream-no-id");

    try {
      const document = await createOwnedDocument(isolated.request);
      const chatId = generateUUID();
      const { saveChat } = await getDbQueries();

      await saveChat({
        id: chatId,
        userId: document.userId,
        title: "Stream Route Seed Chat",
        visibility: "private",
      });

      const response = await isolated.request.get(`/api/chat/${chatId}/stream`);
      expect(response.status()).toBe(404);

      const payload = await response.json();
      expect(payload.code).toBe("not_found:stream");
    } finally {
      await isolated.context.close();
    }
  });

  test("forbids access to another user's private chat stream", async ({
    browser,
  }) => {
    const ada = await createIsolatedUserContext(browser, "stream-ada");
    const babbage = await createIsolatedUserContext(browser, "stream-babbage");

    try {
      const document = await createOwnedDocument(ada.request);
      const chatId = generateUUID();
      const { createStreamId, saveChat } = await getDbQueries();

      await saveChat({
        id: chatId,
        userId: document.userId,
        title: "Ada Private Stream Chat",
        visibility: "private",
      });

      await createStreamId({
        streamId: generateUUID(),
        chatId,
      });

      const response = await babbage.request.get(`/api/chat/${chatId}/stream`);

      expect(response.status()).toBe(403);
      const payload = await response.json();
      expect(payload.code).toBe("forbidden:chat");
    } finally {
      await ada.context.close();
      await babbage.context.close();
    }
  });

  test("restores the most recent assistant message when no resumable stream exists", async ({
    browser,
  }) => {
    const isolated = await createIsolatedUserContext(browser, "stream-restore");

    try {
      const document = await createOwnedDocument(isolated.request);
      const chatId = generateUUID();
      const { createStreamId, saveChat, saveMessages } = await getDbQueries();

      await saveChat({
        id: chatId,
        userId: document.userId,
        title: "Restorable Stream Chat",
        visibility: "private",
      });

      await saveMessages({
        messages: [
          {
            id: generateUUID(),
            chatId,
            role: "assistant",
            parts: [{ type: "text", text: "Restored assistant message" }],
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });

      await createStreamId({
        streamId: generateUUID(),
        chatId,
      });

      const response = await isolated.request.get(`/api/chat/${chatId}/stream`);
      expect(response.status()).toBe(200);

      const body = await response.text();
      expect(body).toContain("data-appendMessage");
      expect(body).toContain("Restored assistant message");
    } finally {
      await isolated.context.close();
    }
  });
});
