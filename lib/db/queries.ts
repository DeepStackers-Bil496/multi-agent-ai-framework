import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from "drizzle-orm";
import type { ArtifactKind } from "@/components/artifact";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import type { AppUsage } from "../usage";
import { generateUUID } from "../utils";
import {
  type Chat,
  chat,
  type DBMessage,
  document,
  message,
  type Suggestion,
  stream,
  suggestion,
  type User,
  user,
  vote,
  agentPreference,
  type AgentPreference,
  agentConfiguration,
  type AgentConfiguration,
  userProfile,
  type UserProfile,
} from "./schema";
import { generateHashedPassword } from "./utils";
import { drizzle } from "drizzle-orm/neon-serverless";
import pool from "./pool";

// biome-ignore lint: Forbidden non-null assertion.
const db = drizzle(pool);

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map(c => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// ============================================================================
// Dashboard - Agent Preferences
// ============================================================================

export async function getAgentPreferences({
  userId,
}: {
  userId: string;
}): Promise<AgentPreference[]> {
  try {
    return await db
      .select()
      .from(agentPreference)
      .where(eq(agentPreference.userId, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get agent preferences"
    );
  }
}

export async function upsertAgentPreference({
  userId,
  agentId,
  enabled,
}: {
  userId: string;
  agentId: string;
  enabled: boolean;
}) {
  try {
    const existing = await db
      .select()
      .from(agentPreference)
      .where(
        and(
          eq(agentPreference.userId, userId),
          eq(agentPreference.agentId, agentId)
        )
      );

    if (existing.length > 0) {
      return await db
        .update(agentPreference)
        .set({ enabled, updatedAt: new Date() })
        .where(
          and(
            eq(agentPreference.userId, userId),
            eq(agentPreference.agentId, agentId)
          )
        );
    }

    return await db.insert(agentPreference).values({
      userId,
      agentId,
      enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert agent preference"
    );
  }
}

// ============================================================================
// Dashboard - Agent Configuration (model, API keys, secrets)
// ============================================================================

export async function getAgentConfiguration({
  userId,
  agentId,
}: {
  userId: string;
  agentId: string;
}): Promise<AgentConfiguration | null> {
  try {
    const [config] = await db
      .select()
      .from(agentConfiguration)
      .where(
        and(
          eq(agentConfiguration.userId, userId),
          eq(agentConfiguration.agentId, agentId)
        )
      );
    return config || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get agent configuration"
    );
  }
}

export async function getAllAgentConfigurations({
  userId,
}: {
  userId: string;
}): Promise<AgentConfiguration[]> {
  try {
    return await db
      .select()
      .from(agentConfiguration)
      .where(eq(agentConfiguration.userId, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get agent configurations"
    );
  }
}

export async function upsertAgentConfiguration({
  userId,
  agentId,
  deploymentType,
  provider,
  modelId,
  apiKey,
  baseUrl,
  chatTemplate,
  customTemplate,
  agentSecrets,
}: {
  userId: string;
  agentId: string;
  deploymentType?: string;
  provider?: string | null;
  modelId?: string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  chatTemplate?: string | null;
  customTemplate?: Record<string, unknown> | null;
  agentSecrets?: string | null;
}): Promise<AgentConfiguration> {
  try {
    const existing = await getAgentConfiguration({ userId, agentId });

    if (existing) {
      const updateData: Partial<AgentConfiguration> = {
        updatedAt: new Date(),
      };

      if (deploymentType !== undefined)
        updateData.deploymentType = deploymentType;
      if (provider !== undefined) updateData.provider = provider;
      if (modelId !== undefined) updateData.modelId = modelId;
      if (apiKey !== undefined) updateData.apiKey = apiKey;
      if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
      if (chatTemplate !== undefined) updateData.chatTemplate = chatTemplate;
      if (customTemplate !== undefined) updateData.customTemplate = customTemplate;
      if (agentSecrets !== undefined) updateData.agentSecrets = agentSecrets;

      const [updated] = await db
        .update(agentConfiguration)
        .set(updateData)
        .where(
          and(
            eq(agentConfiguration.userId, userId),
            eq(agentConfiguration.agentId, agentId)
          )
        )
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(agentConfiguration)
      .values({
        userId,
        agentId,
        deploymentType: deploymentType || "cloud",
        provider: provider ?? null,
        modelId: modelId ?? null,
        apiKey: apiKey ?? null,
        baseUrl: baseUrl ?? null,
        chatTemplate: chatTemplate ?? null,
        customTemplate: customTemplate ?? null,
        agentSecrets: agentSecrets ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert agent configuration"
    );
  }
}

export async function deleteAgentConfiguration({
  userId,
  agentId,
}: {
  userId: string;
  agentId: string;
}): Promise<void> {
  try {
    await db
      .delete(agentConfiguration)
      .where(
        and(
          eq(agentConfiguration.userId, userId),
          eq(agentConfiguration.agentId, agentId)
        )
      );
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete agent configuration"
    );
  }
}

// ============================================================================
// Dashboard - Analytics
// ============================================================================

export async function getDashboardAnalytics({ userId }: { userId: string }) {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get total chats count
    const [chatStats] = await db
      .select({ count: count(chat.id) })
      .from(chat)
      .where(eq(chat.userId, userId));

    // Get total messages count
    const [messageStats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(eq(chat.userId, userId));

    // Get recent chats (last 30 days)
    const recentChats = await db
      .select({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        lastContext: chat.lastContext,
      })
      .from(chat)
      .where(and(eq(chat.userId, userId), gte(chat.createdAt, thirtyDaysAgo)))
      .orderBy(desc(chat.createdAt))
      .limit(10);

    // Get messages per day for the last 30 days
    const messagesPerDay = await db
      .select({
        date: message.createdAt,
        count: count(message.id),
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(and(eq(chat.userId, userId), gte(message.createdAt, thirtyDaysAgo)))
      .groupBy(message.createdAt)
      .orderBy(asc(message.createdAt));

    // Aggregate messages by date
    const messagesByDate = new Map<string, number>();
    for (const row of messagesPerDay) {
      const dateKey = row.date.toISOString().split("T")[0];
      messagesByDate.set(dateKey, (messagesByDate.get(dateKey) || 0) + row.count);
    }

    // Calculate total tokens from lastContext
    let totalTokens = 0;
    for (const chatItem of recentChats) {
      const context = chatItem.lastContext as AppUsage | null;
      if (context?.totalTokens) {
        totalTokens += context.totalTokens;
      }
    }

    return {
      summary: {
        totalChats: chatStats?.count ?? 0,
        totalMessages: messageStats?.count ?? 0,
        totalTokens,
      },
      recentChats: recentChats.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt.toISOString(),
      })),
      messagesPerDay: Array.from(messagesByDate.entries()).map(
        ([date, msgCount]) => ({
          date,
          count: msgCount,
        })
      ),
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get dashboard analytics"
    );
  }
}

// ============================================================================
// User Profile - Settings
// ============================================================================

export async function getUserProfile({
  userId,
}: {
  userId: string;
}): Promise<UserProfile | null> {
  try {
    const [profile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, userId));

    return profile || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user profile"
    );
  }
}

export async function upsertUserProfile({
  userId,
  fullName,
  nickname,
  workType,
  personalPreferences,
  notifyResponseCompletions,
  notifyEmails,
}: {
  userId: string;
  fullName?: string | null;
  nickname?: string | null;
  workType?: string | null;
  personalPreferences?: string | null;
  notifyResponseCompletions?: boolean;
  notifyEmails?: boolean;
}): Promise<UserProfile> {
  try {
    const existing = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, userId));

    if (existing.length > 0) {
      const updateData: Partial<UserProfile> = {
        updatedAt: new Date(),
      };

      if (fullName !== undefined) updateData.fullName = fullName;
      if (nickname !== undefined) updateData.nickname = nickname;
      if (workType !== undefined) updateData.workType = workType;
      if (personalPreferences !== undefined)
        updateData.personalPreferences = personalPreferences;
      if (notifyResponseCompletions !== undefined)
        updateData.notifyResponseCompletions = notifyResponseCompletions;
      if (notifyEmails !== undefined) updateData.notifyEmails = notifyEmails;

      const [updated] = await db
        .update(userProfile)
        .set(updateData)
        .where(eq(userProfile.userId, userId))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(userProfile)
      .values({
        userId,
        fullName: fullName ?? null,
        nickname: nickname ?? null,
        workType: workType ?? null,
        personalPreferences: personalPreferences ?? null,
        notifyResponseCompletions: notifyResponseCompletions ?? true,
        notifyEmails: notifyEmails ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to upsert user profile"
    );
  }
}
