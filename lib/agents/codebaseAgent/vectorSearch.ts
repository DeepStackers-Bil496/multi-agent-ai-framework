/**
 * Vector Search Service
 * Uses PostgreSQL pgvector for cosine similarity search on code embeddings
 */

import { cosineDistance, sql, asc, eq, and } from "drizzle-orm";
import { codebaseEmbedding } from "@/lib/db/schema";
import { drizzle } from "drizzle-orm/neon-serverless";
import pool from "@/lib/db/pool";
import { getEmbedding } from "./embeddings";

const db = drizzle(pool);

export interface SearchResult {
    id: string;
    filePath: string;
    chunkType: string;
    chunkName: string | null;
    parentClass: string | null;
    content: string;
    startLine: number | null;
    endLine: number | null;
    distance: number;
}

export interface SearchOptions {
    limit?: number;
    filePathPrefix?: string;
    chunkType?: string;
}

/**
 * Search the codebase for relevant code snippets using vector similarity
 * @param query Natural language query
 * @param options Search options (limit, file path filter, chunk type filter)
 * @returns Array of search results sorted by relevance
 */
export async function searchCodebase(
    query: string,
    options: SearchOptions = {}
): Promise<SearchResult[]> {
    const { limit = 5, filePathPrefix, chunkType } = options;

    // Generate embedding for the query
    const queryEmbedding = await getEmbedding(query);

    // Build the where clause
    const conditions = [];

    if (filePathPrefix) {
        conditions.push(sql`${codebaseEmbedding.filePath} LIKE ${filePathPrefix + '%'}`);
    }

    if (chunkType) {
        conditions.push(eq(codebaseEmbedding.chunkType, chunkType as any));
    }

    // Cosine similarity search
    const results = await db
        .select({
            id: codebaseEmbedding.id,
            filePath: codebaseEmbedding.filePath,
            chunkType: codebaseEmbedding.chunkType,
            chunkName: codebaseEmbedding.chunkName,
            parentClass: codebaseEmbedding.parentClass,
            content: codebaseEmbedding.content,
            startLine: codebaseEmbedding.startLine,
            endLine: codebaseEmbedding.endLine,
            distance: cosineDistance(codebaseEmbedding.embedding, queryEmbedding),
        })
        .from(codebaseEmbedding)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(cosineDistance(codebaseEmbedding.embedding, queryEmbedding)))
        .limit(limit);

    return results as SearchResult[];
}

/**
 * Get all embeddings for a specific file (for re-indexing)
 * @param filePath Relative file path
 * @returns Existing embeddings for the file
 */
export async function getEmbeddingsByFilePath(filePath: string) {
    return await db
        .select()
        .from(codebaseEmbedding)
        .where(eq(codebaseEmbedding.filePath, filePath));
}

/**
 * Delete all embeddings for a specific file (for re-indexing)
 * @param filePath Relative file path
 */
export async function deleteEmbeddingsByFilePath(filePath: string) {
    return await db
        .delete(codebaseEmbedding)
        .where(eq(codebaseEmbedding.filePath, filePath));
}

/**
 * Insert new embeddings into the database
 * @param embeddings Array of embedding records to insert
 */
export async function insertEmbeddings(
    embeddings: Array<{
        filePath: string;
        chunkType: string;
        chunkName: string | null;
        parentClass: string | null;
        content: string;
        startLine: number | null;
        endLine: number | null;
        embedding: number[];
    }>
) {
    if (embeddings.length === 0) return;

    return await db.insert(codebaseEmbedding).values(
        embeddings.map(e => ({
            filePath: e.filePath,
            chunkType: e.chunkType as "function" | "class" | "method" | "import" | "general",
            chunkName: e.chunkName,
            parentClass: e.parentClass,
            content: e.content,
            startLine: e.startLine,
            endLine: e.endLine,
            embedding: e.embedding,
        }))
    );
}

/**
 * Get total count of embeddings in the database
 */
export async function getEmbeddingsCount(): Promise<number> {
    const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(codebaseEmbedding);

    return result[0]?.count ?? 0;
}

/**
 * Clear all embeddings from the database
 */
export async function clearAllEmbeddings() {
    return await db.delete(codebaseEmbedding);
}
