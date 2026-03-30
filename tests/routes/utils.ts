import type { APIRequestContext, Browser } from "@playwright/test";
import { expect } from "../fixtures";
import { createAuthenticatedContext, type UserContext } from "../helpers";
import type { Document } from "@/lib/db/schema";
import type { AppUsage } from "@/lib/usage";
import type { ExecutionStep } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type OwnedDocument = Omit<Document, "createdAt"> & { createdAt: Date };

async function getDbQueries() {
  return import("@/lib/db/queries");
}

export async function createIsolatedUserContext(
  browser: Browser,
  prefix: string
): Promise<UserContext> {
  return createAuthenticatedContext({
    browser,
    name: `${prefix}-${generateUUID()}`,
  });
}

export function expectGuestRedirect(response: {
  status(): number;
  headers(): Record<string, string>;
}) {
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers().location).toContain("/api/auth/guest");
}

export async function createOwnedDocument(
  request: APIRequestContext,
  overrides?: Partial<Pick<Document, "title" | "kind" | "content">>
): Promise<OwnedDocument> {
  const documentId = generateUUID();
  const response = await request.post(`/api/document?id=${documentId}`, {
    data: {
      title: overrides?.title ?? "Route Test Document",
      kind: overrides?.kind ?? "text",
      content: overrides?.content ?? "Route test content",
    },
  });

  expect(response.status()).toBe(200);
  const [document] = (await response.json()) as Array<
    Omit<Document, "createdAt"> & { createdAt: string }
  >;

  return {
    ...document,
    createdAt: new Date(document.createdAt),
  };
}

export async function seedChatForUser({
  userId,
  title,
  assistantParts,
  lastContext,
}: {
  userId: string;
  title: string;
  assistantParts?: Array<Record<string, unknown>>;
  lastContext?: { totalTokens?: number; inputTokens?: number; outputTokens?: number };
}) {
  const chatId = generateUUID();
  const { saveChat, saveMessages, updateChatLastContextById } =
    await getDbQueries();

  await saveChat({
    id: chatId,
    userId,
    title,
    visibility: "private",
  });

  await saveMessages({
    messages: [
      {
        id: generateUUID(),
        chatId,
        role: "user",
        parts: [{ type: "text", text: `${title} user prompt` }],
        attachments: [],
        createdAt: new Date(),
      },
      {
        id: generateUUID(),
        chatId,
        role: "assistant",
        parts:
          assistantParts ??
          [{ type: "text", text: `${title} assistant response` }],
        attachments: [],
        createdAt: new Date(),
      },
    ],
  });

  if (lastContext) {
    await updateChatLastContextById({
      chatId,
      context: {
        totalTokens: lastContext.totalTokens ?? 0,
        inputTokens: lastContext.inputTokens ?? 0,
        outputTokens: lastContext.outputTokens ?? 0,
      } as AppUsage,
    });
  }

  return chatId;
}

export async function seedExecutionChatForUser({
  userId,
  title,
  steps,
}: {
  userId: string;
  title: string;
  steps: ExecutionStep[];
}) {
  return seedChatForUser({
    userId,
    title,
    assistantParts: [
      { type: "text", text: "Execution complete" },
      { type: "data-agent-execution", data: steps },
    ],
  });
}

export async function createAgentChat(
  request: APIRequestContext,
  text: string,
  selectedChatModel = "main-agent"
) {
  const chatId = generateUUID();
  const response = await request.post("/api/chat", {
    data: {
      id: chatId,
      message: {
        id: generateUUID(),
        role: "user",
        parts: [{ type: "text", text }],
        createdAt: new Date().toISOString(),
      },
      selectedChatModel,
      selectedVisibilityType: "private",
    },
  });

  expect(response.status()).toBe(200);
  await response.text();
  return chatId;
}

export async function getAssistantMessageId(chatId: string) {
  const { getMessagesByChatId } = await getDbQueries();
  const messages = await getMessagesByChatId({ id: chatId });
  const assistantMessage = messages.find((message) => message.role === "assistant");

  if (!assistantMessage) {
    throw new Error(`No assistant message found for chat ${chatId}`);
  }

  return assistantMessage.id;
}

export async function seedDocumentSuggestion({
  document,
  userId,
}: {
  document: OwnedDocument;
  userId: string;
}) {
  const { saveSuggestions } = await getDbQueries();
  const suggestion = {
    id: generateUUID(),
    documentId: document.id,
    documentCreatedAt: document.createdAt,
    originalText: "Original sentence",
    suggestedText: "Improved sentence",
    description: "Tighten the wording",
    isResolved: false,
    userId,
    createdAt: new Date(),
  };

  await saveSuggestions({ suggestions: [suggestion] });
  return suggestion;
}
