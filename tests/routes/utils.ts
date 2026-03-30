import type { APIRequestContext, Browser } from "@playwright/test";
import { expect } from "./fixtures";
import {
  createAuthenticatedRequestContext,
  type UserContext,
} from "../helpers";
import type { Document } from "@/lib/db/schema";
import type { AppUsage } from "@/lib/usage";
import type { ExecutionStep } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type OwnedDocument = Omit<Document, "createdAt"> & { createdAt: Date };
type SeededSuggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  originalText: string;
  suggestedText: string;
  description: string;
  isResolved: boolean;
  userId: string;
  createdAt: Date;
};

const TEST_SEED_ROUTE = `http://localhost:${process.env.PORT || 3000}/api/testing/seed`;

async function postTestSeed<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(TEST_SEED_ROUTE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Test seed request failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function createIsolatedUserContext(
  browser: Browser,
  prefix: string
): Promise<UserContext> {
  return createAuthenticatedRequestContext({
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
  const payload = await postTestSeed<{ chatId: string }>({
    action: "seedChat",
    userId,
    title,
    assistantParts:
      assistantParts ??
      [{ type: "text", text: `${title} assistant response` }],
    lastContext: lastContext
      ? ({
          totalTokens: lastContext.totalTokens ?? 0,
          inputTokens: lastContext.inputTokens ?? 0,
          outputTokens: lastContext.outputTokens ?? 0,
        } satisfies AppUsage)
      : undefined,
  });

  return payload.chatId;
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
  const payload = await postTestSeed<{ assistantMessageId: string }>({
    action: "getAssistantMessageId",
    chatId,
  });

  return payload.assistantMessageId;
}

export async function seedDocumentSuggestion({
  document,
  userId,
}: {
  document: OwnedDocument;
  userId: string;
}) {
  const payload = await postTestSeed<{
    id: string;
    documentId: string;
    documentCreatedAt: string;
    originalText: string;
    suggestedText: string;
    description: string;
    isResolved: boolean;
    userId: string;
    createdAt: string;
  }>({
    action: "seedSuggestion",
    documentId: document.id,
    documentCreatedAt: document.createdAt.toISOString(),
    userId,
  });

  return {
    ...payload,
    documentCreatedAt: new Date(payload.documentCreatedAt),
    createdAt: new Date(payload.createdAt),
  } satisfies SeededSuggestion;
}

export async function seedEmptyChatForUser({
  userId,
  title,
}: {
  userId: string;
  title: string;
}) {
  const payload = await postTestSeed<{ chatId: string }>({
    action: "seedEmptyChat",
    userId,
    title,
  });

  return payload.chatId;
}

export async function createStreamIdForChat(chatId: string) {
  const payload = await postTestSeed<{ streamId: string }>({
    action: "createStreamId",
    chatId,
  });

  return payload.streamId;
}
