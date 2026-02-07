import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
}, (table) => ({
  userIdIdx: index("chat_userId_idx").on(table.userId),
}));

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
}, (table) => ({
  chatIdIdx: index("message_chatId_idx").on(table.chatId),
  createdAtIdx: index("message_createdAt_idx").on(table.createdAt),
}));

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// ============================================================================
// User Dashboard - Agent preferences
// ============================================================================

export const agentPreference = pgTable(
  "AgentPreference",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    agentId: varchar("agentId", { length: 64 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userAgentIdx: index("user_agent_idx").on(table.userId, table.agentId),
  })
);

export type AgentPreference = InferSelectModel<typeof agentPreference>;

// ============================================================================
// User Dashboard - Agent configuration (model, API keys, secrets)
// ============================================================================

export const agentConfiguration = pgTable(
  "AgentConfiguration",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    agentId: varchar("agentId", { length: 64 }).notNull(),
    // Model deployment type: "cloud" for API providers, "self-hosted" for Ollama/vLLM, "custom" for custom endpoints
    deploymentType: varchar("deploymentType", { length: 16 })
      .notNull()
      .default("cloud"),
    // LLM provider (google, openai, anthropic, groq, mistral, ollama, custom)
    provider: varchar("provider", { length: 32 }),
    // Model identifier (e.g., "gemini-2.5-flash", "gpt-4o")
    modelId: varchar("modelId", { length: 128 }),
    // Encrypted API key for cloud providers
    apiKey: text("apiKey"),
    // Base URL for self-hosted deployments (e.g., Ollama ngrok URL)
    baseUrl: text("baseUrl"),
    // Chat template type for custom deployments (auto, chatml, llama2, llama3, etc.)
    chatTemplate: varchar("chatTemplate", { length: 32 }),
    // Custom template configuration as JSON (when chatTemplate is "custom")
    customTemplate: jsonb("customTemplate"),
    // Encrypted JSON object for agent-specific secrets
    // e.g., { "GITHUB_PAT": "encrypted...", "HF_TOKEN": "encrypted..." }
    agentSecrets: text("agentSecrets"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userAgentConfigIdx: index("user_agent_config_idx").on(
      table.userId,
      table.agentId
    ),
  })
);

export type AgentConfiguration = InferSelectModel<typeof agentConfiguration>;

// ============================================================================
// CodebaseAgent RAG - Vector embeddings for code chunks
// ============================================================================

export const codebaseEmbedding = pgTable(
  "CodebaseEmbedding",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    filePath: text("filePath").notNull(),
    chunkType: varchar("chunkType", {
      enum: ["function", "class", "method", "import", "general"],
    }).notNull(),
    chunkName: text("chunkName"),
    parentClass: text("parentClass"),
    content: text("content").notNull(),
    startLine: integer("startLine"),
    endLine: integer("endLine"),
    // Google gemini-embedding-001 with reduced output dimensionality (768)
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    // HNSW index for fast cosine similarity search
    embeddingCosineIdx: index("embedding_cosine_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
    // Index for file path filtering
    filepathIdx: index("filepath_idx").on(table.filePath),
  })
);

export type CodebaseEmbedding = InferSelectModel<typeof codebaseEmbedding>;

// ============================================================================
// User Profile - Settings and preferences
// ============================================================================

export const userProfile = pgTable(
  "UserProfile",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id)
      .unique(),
    fullName: varchar("fullName", { length: 128 }),
    nickname: varchar("nickname", { length: 64 }),
    workType: varchar("workType", { length: 32 }),
    personalPreferences: text("personalPreferences"),
    notifyResponseCompletions: boolean("notifyResponseCompletions")
      .notNull()
      .default(true),
    notifyEmails: boolean("notifyEmails").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_profile_userId_idx").on(table.userId),
  })
);

export type UserProfile = InferSelectModel<typeof userProfile>;
