/**
 * Google Text Embeddings Service
 * Uses Google's text-embedding-004 model (768 dimensions) for generating embeddings
 */

import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Google text-embedding-004 produces 768-dimensional vectors
export const EMBEDDING_DIMENSIONS = 768;

// Lazy initialization of embeddings client
let embeddingsClient: GoogleGenerativeAIEmbeddings | null = null;

function getEmbeddingsClient(): GoogleGenerativeAIEmbeddings {
    if (!embeddingsClient) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY environment variable is required for embeddings");
        }
        embeddingsClient = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "text-embedding-004",
        });
    }
    return embeddingsClient;
}

/**
 * Generate embedding for a single text
 * @param text Text to embed
 * @returns 768-dimensional embedding vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
    const client = getEmbeddingsClient();
    return await client.embedQuery(text);
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * @param texts Array of texts to embed
 * @returns Array of 768-dimensional embedding vectors
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
    const client = getEmbeddingsClient();
    return await client.embedDocuments(texts);
}

/**
 * Generate embeddings in batches to avoid rate limits
 * @param texts Array of texts to embed
 * @param batchSize Number of texts to process at a time (default: 100)
 * @returns Array of 768-dimensional embedding vectors
 */
export async function getEmbeddingsBatched(
    texts: string[],
    batchSize = 100
): Promise<number[][]> {
    const client = getEmbeddingsClient();
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await client.embedDocuments(batch);
        results.push(...batchEmbeddings);

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < texts.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}
