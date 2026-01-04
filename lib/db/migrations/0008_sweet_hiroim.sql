-- Enable pgvector extension (Neon has this pre-installed)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "CodebaseEmbedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filePath" text NOT NULL,
	"chunkType" varchar NOT NULL,
	"chunkName" text,
	"parentClass" text,
	"content" text NOT NULL,
	"startLine" integer,
	"endLine" integer,
	"embedding" vector(768) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embedding_cosine_idx" ON "CodebaseEmbedding" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "filepath_idx" ON "CodebaseEmbedding" USING btree ("filePath");