#!/usr/bin/env npx tsx
/**
 * Codebase Indexer Script
 * Scans the project, chunks source files, generates embeddings, and stores them in PostgreSQL
 * 
 * Usage: pnpm run index:codebase
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { chunkFile, type CodeChunk } from "./chunking";
import { getEmbeddingsBatched } from "./embeddings";
import {
    insertEmbeddings,
    clearAllEmbeddings,
    getEmbeddingsCount
} from "./vectorSearch";

// Load environment variables
config({ path: ".env.local" });

// Project root directory
const PROJECT_ROOT = process.cwd();

// Directories to index
const INCLUDE_DIRS = [
    "lib",
    "app",
    "components",
    "hooks",
];

// Patterns to exclude
const EXCLUDE_PATTERNS = [
    /node_modules/,
    /\.next/,
    /dist/,
    /\.git/,
    /coverage/,
    /\.test\.(ts|tsx|js|jsx)$/,
    /\.spec\.(ts|tsx|js|jsx)$/,
    /\.d\.ts$/,
    /\.config\.(ts|js|mjs)$/,
];

// File extensions to index
const INCLUDE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * Recursively find all files matching criteria
 */
function findFiles(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(PROJECT_ROOT, fullPath);

        // Check if this path should be excluded
        const shouldExclude = EXCLUDE_PATTERNS.some(pattern => pattern.test(relativePath));
        if (shouldExclude) continue;

        if (entry.isDirectory()) {
            findFiles(fullPath, files);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (INCLUDE_EXTENSIONS.includes(ext)) {
                files.push(fullPath);
            }
        }
    }

    return files;
}

/**
 * Main indexing function
 */
async function indexCodebase() {
    console.log("🚀 Starting codebase indexing...\n");

    // Validate environment
    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY environment variable is required");
        process.exit(1);
    }

    if (!process.env.POSTGRES_URL) {
        console.error("❌ POSTGRES_URL environment variable is required");
        process.exit(1);
    }

    // Find all source files
    console.log("📁 Scanning directories:", INCLUDE_DIRS.join(", "));

    const allFiles: string[] = [];
    for (const dir of INCLUDE_DIRS) {
        const dirPath = path.join(PROJECT_ROOT, dir);
        if (fs.existsSync(dirPath)) {
            findFiles(dirPath, allFiles);
        }
    }

    console.log(`📄 Found ${allFiles.length} files to index\n`);

    if (allFiles.length === 0) {
        console.log("⚠️  No files found to index");
        return;
    }

    // Chunk all files
    console.log("🔪 Chunking files...");
    const allChunks: CodeChunk[] = [];

    for (const file of allFiles) {
        try {
            const chunks = chunkFile(file, PROJECT_ROOT);
            allChunks.push(...chunks);

            if (chunks.length > 0) {
                console.log(`  ✓ ${path.relative(PROJECT_ROOT, file)}: ${chunks.length} chunks`);
            }
        } catch (error) {
            console.error(`  ✗ ${path.relative(PROJECT_ROOT, file)}: ${error}`);
        }
    }

    console.log(`\n📦 Total chunks: ${allChunks.length}\n`);

    if (allChunks.length === 0) {
        console.log("⚠️  No chunks generated");
        return;
    }

    // Generate embeddings
    console.log("🧠 Generating embeddings (this may take a while)...");

    const contents = allChunks.map(chunk => {
        // Create a searchable text representation
        let text = chunk.content;

        // Add metadata context for better search
        if (chunk.chunkName) {
            text = `${chunk.chunkType} ${chunk.chunkName}:\n${text}`;
        }
        if (chunk.parentClass) {
            text = `class ${chunk.parentClass}\n${text}`;
        }
        text = `file: ${chunk.filePath}\n${text}`;

        return text;
    });

    const embeddings = await getEmbeddingsBatched(contents, 50);

    console.log(`✓ Generated ${embeddings.length} embeddings\n`);

    // Clear existing embeddings and insert new ones
    console.log("💾 Saving to database...");

    const existingCount = await getEmbeddingsCount();
    if (existingCount > 0) {
        console.log(`  Clearing ${existingCount} existing embeddings...`);
        await clearAllEmbeddings();
    }

    // Insert in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batchChunks = allChunks.slice(i, i + BATCH_SIZE);
        const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

        const records = batchChunks.map((chunk, idx) => ({
            filePath: chunk.filePath,
            chunkType: chunk.chunkType,
            chunkName: chunk.chunkName,
            parentClass: chunk.parentClass,
            content: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            embedding: batchEmbeddings[idx],
        }));

        await insertEmbeddings(records);
        console.log(`  Inserted ${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length} embeddings`);
    }

    const finalCount = await getEmbeddingsCount();
    console.log(`\n✅ Indexing complete! ${finalCount} embeddings stored in database.\n`);

    // Print summary
    console.log("📊 Summary by chunk type:");
    const typeCounts = allChunks.reduce((acc, chunk) => {
        acc[chunk.chunkType] = (acc[chunk.chunkType] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    for (const [type, count] of Object.entries(typeCounts)) {
        console.log(`  ${type}: ${count}`);
    }
}

// Run the indexer
indexCodebase().catch(error => {
    console.error("❌ Indexing failed:", error);
    process.exit(1);
});
