import { getMessageByErrorCode } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";
import { expect, test } from "../fixtures";
import { TEST_PROMPTS } from "../prompts/routes";

const chatIdsCreatedByAda: string[] = [];

type AgentEvent = {
  type: string;
  payload?: {
    content?: unknown;
    id?: string;
    name?: string;
  };
};

function parseNdjson(body: string): AgentEvent[] {
  return body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AgentEvent);
}

function extractStreamText(events: AgentEvent[]): string {
  return events
    .filter((event) => event.type === "agent_stream")
    .map((event) =>
      typeof event.payload?.content === "string" ? event.payload.content : ""
    )
    .join("");
}

test.describe.serial("/api/chat", () => {
  test("Ada cannot invoke a chat generation with empty request body", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/chat", {
      data: JSON.stringify({}),
    });

    expect(response.status()).toBe(400);

    const { code, message } = await response.json();
    expect(code).toEqual("bad_request:api");
    expect(message).toEqual(getMessageByErrorCode("bad_request:api"));
  });

  test("Ada can invoke chat generation with the active agent stream contract", async ({
    adaContext,
  }) => {
    const chatId = generateUUID();

    const response = await adaContext.request.post("/api/chat", {
      data: {
        id: chatId,
        message: TEST_PROMPTS.SKY.MESSAGE,
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.text();
    const events = parseNdjson(body);

    expect(events[0]?.type).toBe("agent_started");
    expect(events.some((event) => event.type === "agent_stream")).toBe(true);
    expect(events.at(-1)?.type).toBe("agent_ended");
    expect(extractStreamText(events)).toBe("It's just blue duh!");

    chatIdsCreatedByAda.push(chatId);
  });

  test("Babbage cannot append message to Ada's chat", async ({
    babbageContext,
  }) => {
    const [chatId] = chatIdsCreatedByAda;

    const response = await babbageContext.request.post("/api/chat", {
      data: {
        id: chatId,
        message: TEST_PROMPTS.GRASS.MESSAGE,
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(response.status()).toBe(403);

    const { code, message } = await response.json();
    expect(code).toEqual("forbidden:chat");
    expect(message).toEqual(getMessageByErrorCode("forbidden:chat"));
  });

  test("Babbage cannot delete Ada's chat", async ({ babbageContext }) => {
    const [chatId] = chatIdsCreatedByAda;

    const response = await babbageContext.request.delete(`/api/chat?id=${chatId}`);

    expect(response.status()).toBe(403);

    const { code, message } = await response.json();
    expect(code).toEqual("forbidden:chat");
    expect(message).toEqual(getMessageByErrorCode("forbidden:chat"));
  });

  test("Ada can delete her own chat", async ({ adaContext }) => {
    const [chatId] = chatIdsCreatedByAda;

    const response = await adaContext.request.delete(`/api/chat?id=${chatId}`);

    expect(response.status()).toBe(200);

    const deletedChat = await response.json();
    expect(deletedChat).toMatchObject({ id: chatId });
  });

  test("Ada cannot resume stream of chat that does not exist", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get(
      `/api/chat/${generateUUID()}/stream`
    );

    expect(response.status()).toBe(404);
  });

  test("Ada can restore the most recent assistant message via /api/chat/:id/stream", async ({
    adaContext,
  }) => {
    const chatId = generateUUID();

    const firstResponse = await adaContext.request.post("/api/chat", {
      data: {
        id: chatId,
        message: TEST_PROMPTS.GRASS.MESSAGE,
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(firstResponse.status()).toBe(200);
    await firstResponse.text();

    const secondResponse = await adaContext.request.get(`/api/chat/${chatId}/stream`);

    expect(secondResponse.status()).toBe(200);

    const secondResponseContent = await secondResponse.text();
    expect(secondResponseContent).toContain("data-appendMessage");
    expect(secondResponseContent).toContain("It's just green duh!");
  });

  test("Babbage cannot resume a private chat generation that belongs to Ada", async ({
    adaContext,
    babbageContext,
  }) => {
    const chatId = generateUUID();

    const firstResponse = await adaContext.request.post("/api/chat", {
      data: {
        id: chatId,
        message: TEST_PROMPTS.GRASS.MESSAGE,
        selectedChatModel: "main-agent",
        selectedVisibilityType: "private",
      },
    });

    expect(firstResponse.status()).toBe(200);
    await firstResponse.text();

    const secondResponse = await babbageContext.request.get(
      `/api/chat/${chatId}/stream`
    );

    expect(secondResponse.status()).toBe(403);
  });

  test("Babbage can restore a public chat generation that belongs to Ada", async ({
    adaContext,
    babbageContext,
  }) => {
    const chatId = generateUUID();

    const firstResponse = await adaContext.request.post("/api/chat", {
      data: {
        id: chatId,
        message: TEST_PROMPTS.SKY.MESSAGE,
        selectedChatModel: "main-agent",
        selectedVisibilityType: "public",
      },
    });

    expect(firstResponse.status()).toBe(200);
    await firstResponse.text();

    const secondResponse = await babbageContext.request.get(
      `/api/chat/${chatId}/stream`
    );

    expect(secondResponse.status()).toBe(200);

    const secondResponseContent = await secondResponse.text();
    expect(secondResponseContent).toContain("data-appendMessage");
    expect(secondResponseContent).toContain("It's just blue duh!");
  });
});
