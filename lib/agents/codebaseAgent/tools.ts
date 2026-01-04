/**
 * CodebaseAgent Tools
 * Provides retrieval tool for searching the codebase using vector similarity
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { searchCodebase } from "./vectorSearch";

/**
 * Tool for searching the codebase for relevant code snippets
 */
export const searchCodebaseTool = new DynamicStructuredTool({
    name: "search_codebase",
    description: `Search the codebase for relevant code snippets using semantic search. 
Use this tool to find implementations, understand how features work, or locate specific code.
The search uses vector similarity to find the most relevant code chunks.

Tips for effective searches:
- Be specific about what you're looking for (e.g., "authentication middleware" instead of just "auth")
- Use filePathPrefix to narrow down to specific directories (e.g., "lib/agents/" for agent code)
- Search for function names, class names, or concepts`,
    schema: z.object({
        query: z.string().describe("Natural language query about the codebase. Be specific about what you're looking for."),
        filePathPrefix: z.string().optional().describe("Optional: filter to specific directory prefix, e.g., 'lib/agents/' or 'components/'"),
        limit: z.number().optional().default(5).describe("Number of results to return (default: 5, max: 10)"),
    }),
    func: async ({ query, filePathPrefix, limit }) => {
        try {
            const results = await searchCodebase(query, {
                limit: Math.min(limit || 5, 10),
                filePathPrefix
            });

            if (results.length === 0) {
                return "No relevant code found for this query. Try a different search query or remove the file path filter.";
            }

            // Format results for the LLM
            const formattedResults = results.map((r, i) => {
                const location = r.startLine && r.endLine
                    ? `${r.filePath}:${r.startLine}-${r.endLine}`
                    : r.filePath;

                const chunkInfo = r.chunkName
                    ? `${r.chunkType}: ${r.chunkName}${r.parentClass ? ` (in class ${r.parentClass})` : ''}`
                    : r.chunkType;

                // Truncate very long content
                const content = r.content.length > 1500
                    ? r.content.slice(0, 1500) + '\n... (truncated)'
                    : r.content;

                return `### [${i + 1}] ${location}
**Type**: ${chunkInfo}
**Relevance Score**: ${(1 - r.distance).toFixed(3)}

\`\`\`typescript
${content}
\`\`\``;
            }).join("\n\n---\n\n");

            return `Found ${results.length} relevant code snippets:\n\n${formattedResults}`;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            return `Error searching codebase: ${errorMessage}. The codebase may not be indexed yet. Run 'pnpm run index:codebase' to index it.`;
        }
    },
});

/**
 * Export all tools for the CodebaseAgent
 */
export function createCodebaseAgentTools(): DynamicStructuredTool[] {
    return [searchCodebaseTool];
}
