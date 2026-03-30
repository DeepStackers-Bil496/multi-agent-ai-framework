import {
  createStreamId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  saveSuggestions,
  updateChatLastContextById,
} from "@/lib/db/queries";
import type { AppUsage } from "@/lib/usage";
import { generateUUID } from "@/lib/utils";
import { NextRequest } from "next/server";

function ensurePlaywrightEnabled() {
  if (process.env.PLAYWRIGHT !== "True") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return null;
}

export async function POST(request: NextRequest) {
  const disabledResponse = ensurePlaywrightEnabled();

  if (disabledResponse) {
    return disabledResponse;
  }

  const body = (await request.json()) as {
    action?: string;
    userId?: string;
    title?: string;
    assistantParts?: Array<Record<string, unknown>>;
    lastContext?: AppUsage;
    chatId?: string;
    streamId?: string;
    documentId?: string;
    documentCreatedAt?: string;
  };

  switch (body.action) {
    case "seedEmptyChat": {
      if (!body.userId || !body.title) {
        return Response.json({ error: "userId and title are required" }, { status: 400 });
      }

      const chatId = generateUUID();
      await saveChat({
        id: chatId,
        userId: body.userId,
        title: body.title,
        visibility: "private",
      });

      return Response.json({ chatId });
    }

    case "seedChat": {
      if (!body.userId || !body.title) {
        return Response.json({ error: "userId and title are required" }, { status: 400 });
      }

      const chatId = generateUUID();
      await saveChat({
        id: chatId,
        userId: body.userId,
        title: body.title,
        visibility: "private",
      });

      await saveMessages({
        messages: [
          {
            id: generateUUID(),
            chatId,
            role: "user",
            parts: [{ type: "text", text: `${body.title} user prompt` }],
            attachments: [],
            createdAt: new Date(),
          },
          {
            id: generateUUID(),
            chatId,
            role: "assistant",
            parts:
              body.assistantParts ??
              [{ type: "text", text: `${body.title} assistant response` }],
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });

      if (body.lastContext) {
        await updateChatLastContextById({
          chatId,
          context: body.lastContext,
        });
      }

      return Response.json({ chatId });
    }

    case "createStreamId": {
      if (!body.chatId) {
        return Response.json({ error: "chatId is required" }, { status: 400 });
      }

      const streamId = body.streamId ?? generateUUID();
      await createStreamId({
        streamId,
        chatId: body.chatId,
      });

      return Response.json({ streamId });
    }

    case "getAssistantMessageId": {
      if (!body.chatId) {
        return Response.json({ error: "chatId is required" }, { status: 400 });
      }

      const messages = await getMessagesByChatId({ id: body.chatId });
      const assistantMessage = messages.find((message) => message.role === "assistant");

      if (!assistantMessage) {
        return Response.json({ error: "No assistant message found" }, { status: 404 });
      }

      return Response.json({ assistantMessageId: assistantMessage.id });
    }

    case "seedSuggestion": {
      if (!body.documentId || !body.documentCreatedAt || !body.userId) {
        return Response.json(
          { error: "documentId, documentCreatedAt, and userId are required" },
          { status: 400 }
        );
      }

      const suggestion = {
        id: generateUUID(),
        documentId: body.documentId,
        documentCreatedAt: new Date(body.documentCreatedAt),
        originalText: "Original sentence",
        suggestedText: "Improved sentence",
        description: "Tighten the wording",
        isResolved: false,
        userId: body.userId,
        createdAt: new Date(),
      };

      await saveSuggestions({ suggestions: [suggestion] });

      return Response.json({
        ...suggestion,
        documentCreatedAt: suggestion.documentCreatedAt.toISOString(),
        createdAt: suggestion.createdAt.toISOString(),
      });
    }

    default:
      return Response.json({ error: "Unsupported test seed action" }, { status: 400 });
  }
}
