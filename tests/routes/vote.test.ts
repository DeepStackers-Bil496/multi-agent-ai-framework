import { expect, test } from "../fixtures";
import { createAgentChat, expectGuestRedirect, getAssistantMessageId } from "./utils";
import { generateUUID } from "@/lib/utils";

test.describe.serial("/api/vote", () => {
  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get(`/api/vote?chatId=${generateUUID()}`, {
      maxRedirects: 0,
    });

    expectGuestRedirect(response);
  });

  test("anonymous PATCH is redirected to guest auth", async ({ request }) => {
    const response = await request.patch("/api/vote", {
      maxRedirects: 0,
      data: {
        chatId: generateUUID(),
        messageId: generateUUID(),
        type: "up",
      },
    });

    expectGuestRedirect(response);
  });

  test("chatId query parameter is required for GET", async ({ adaContext }) => {
    const response = await adaContext.request.get("/api/vote");

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(payload.cause).toBe("Parameter chatId is required.");
  });

  test("GET returns 404 for a missing chat", async ({ adaContext }) => {
    const response = await adaContext.request.get(
      `/api/vote?chatId=${generateUUID()}`
    );

    expect(response.status()).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("not_found:chat");
  });

  test("owner sees an empty vote list before voting", async ({ adaContext }) => {
    const chatId = await createAgentChat(adaContext.request, "Why is the sky blue?");

    const response = await adaContext.request.get(`/api/vote?chatId=${chatId}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("another user cannot read votes for someone else's chat", async ({
    adaContext,
    babbageContext,
  }) => {
    const chatId = await createAgentChat(adaContext.request, "Why is grass green?");

    const response = await babbageContext.request.get(`/api/vote?chatId=${chatId}`);

    expect(response.status()).toBe(403);
    const payload = await response.json();
    expect(payload.code).toBe("forbidden:vote");
  });

  test("PATCH requires chatId, messageId, and type", async ({ adaContext }) => {
    const response = await adaContext.request.patch("/api/vote", {
      data: { chatId: generateUUID() },
    });

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(payload.cause).toBe("Parameters chatId, messageId, and type are required.");
  });

  test("PATCH returns 404 for a missing chat", async ({ adaContext }) => {
    const response = await adaContext.request.patch("/api/vote", {
      data: {
        chatId: generateUUID(),
        messageId: generateUUID(),
        type: "up",
      },
    });

    expect(response.status()).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("not_found:vote");
  });

  test("owner can upvote and then update the vote", async ({ adaContext }) => {
    const chatId = await createAgentChat(adaContext.request, "What is MCP?");
    const messageId = await getAssistantMessageId(chatId);

    const upvoteResponse = await adaContext.request.patch("/api/vote", {
      data: {
        chatId,
        messageId,
        type: "up",
      },
    });

    expect(upvoteResponse.status()).toBe(200);
    expect(await upvoteResponse.text()).toBe("Message voted");

    const afterUpvote = await adaContext.request.get(`/api/vote?chatId=${chatId}`);
    expect(afterUpvote.status()).toBe(200);
    expect(await afterUpvote.json()).toEqual([
      {
        chatId,
        messageId,
        isUpvoted: true,
      },
    ]);

    const downvoteResponse = await adaContext.request.patch("/api/vote", {
      data: {
        chatId,
        messageId,
        type: "down",
      },
    });

    expect(downvoteResponse.status()).toBe(200);

    const afterDownvote = await adaContext.request.get(`/api/vote?chatId=${chatId}`);
    expect(afterDownvote.status()).toBe(200);
    expect(await afterDownvote.json()).toEqual([
      {
        chatId,
        messageId,
        isUpvoted: false,
      },
    ]);
  });
});
