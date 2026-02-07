/**
 * Google Text Embeddings Service
 * Uses Google's gemini-embedding-001 model with 768-dimensional output
 * (reduced from 3072 via outputDimensionality for pgvector compatibility)
 */

import { GoogleGenAI } from "@google/genai";

// Using 768 dimensions (reduced from 3072) for pgvector compatibility
export const EMBEDDING_DIMENSIONS = 768;

// Lazy initialization of client
let genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY environment variable is required for embeddings");
        }
        genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return genAI;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error as Error;

            // Check if it's a rate limit error (429)
            const statusCode = (error as { status?: number }).status;
            if (statusCode === 429 && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.log(`[Embeddings] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
                continue;
            }

            throw error;
        }
    }

    throw lastError;
}

/**
 * Generate embedding for a single text
 * @param text Text to embed
 * @returns 768-dimensional embedding vector
 */
export async function getEmbedding(text: string): Promise<number[]> {
    const ai = getGenAI();

    return withRetry(async () => {
        const result = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: text,
            config: {
                outputDimensionality: EMBEDDING_DIMENSIONS,
            },
        });

        return result.embeddings?.[0]?.values ?? [];
    });
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * @param texts Array of texts to embed
 * @returns Array of 768-dimensional embedding vectors
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
        const embedding = await getEmbedding(text);
        results.push(embedding);
        // Small delay between requests to avoid rate limiting
        await sleep(50);
    }

    return results;
}

/**
 * Generate embeddings in batches to avoid rate limits
 * @param texts Array of texts to embed
 * @param batchSize Number of texts to process at a time (default: 20)
 * @returns Array of 768-dimensional embedding vectors
 */
export async function getEmbeddingsBatched(
    texts: string[],
    batchSize = 20
): Promise<number[][]> {
    const results: number[][] = [];
    let processedCount = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        for (const text of batch) {
            const embedding = await withRetry(async () => {
                const ai = getGenAI();
                const result = await ai.models.embedContent({
                    model: "gemini-embedding-001",
                    contents: text,
                    config: {
                        outputDimensionality: EMBEDDING_DIMENSIONS,
                    },
                });
                return result.embeddings?.[0]?.values ?? [];
            });

            results.push(embedding);
            processedCount++;

            // Progress indicator every 50 embeddings
            if (processedCount % 50 === 0) {
                console.log(`  Generated ${processedCount}/${texts.length} embeddings...`);
            }

            // Small delay between requests
            await sleep(100);
        }

        // Longer delay between batches to avoid rate limiting
        if (i + batchSize < texts.length) {
            await sleep(500);
        }
    }

    return results;
}
