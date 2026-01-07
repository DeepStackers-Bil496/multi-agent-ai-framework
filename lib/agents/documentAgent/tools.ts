import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

const sentenceSplitRegex = /(?<=[.!?])\s+/;

function getSentences(content: string): string[] {
    return content
        .split(sentenceSplitRegex)
        .map(sentence => sentence.trim())
        .filter(Boolean);
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(value, max));
}

export function createSummarizeDocumentTool() {
    return new DynamicStructuredTool({
        name: "summarize_document",
        description: "Summarize a document into a concise set of sentences.",
        schema: z.object({
            content: z.string().min(1).describe("Document content to summarize"),
            maxSentences: z.number().int().min(1).optional().default(3).describe("Maximum number of sentences"),
        }),
        func: async ({ content, maxSentences }) => {
            const sentences = getSentences(content);
            if (sentences.length === 0) {
                return "No content available to summarize.";
            }
            const count = clamp(maxSentences ?? 3, 1, sentences.length);
            const summary = sentences.slice(0, count).join(" ");
            return `Summary (${count} sentence${count === 1 ? "" : "s"}): ${summary}`;
        },
    });
}

export function createExtractKeyPointsTool() {
    return new DynamicStructuredTool({
        name: "extract_key_points",
        description: "Extract key points from a document as bullet points.",
        schema: z.object({
            content: z.string().min(1).describe("Document content to analyze"),
            maxPoints: z.number().int().min(1).optional().default(5).describe("Maximum number of key points"),
        }),
        func: async ({ content, maxPoints }) => {
            const sentences = getSentences(content);
            if (sentences.length === 0) {
                return "No content available to extract key points.";
            }
            const count = clamp(maxPoints ?? 5, 1, sentences.length);
            const points = sentences.slice(0, count).map(sentence => `- ${sentence}`);
            return `Key points:\n${points.join("\n")}`;
        },
    });
}

export function createGenerateReportTool() {
    return new DynamicStructuredTool({
        name: "generate_report",
        description: "Generate a structured report using a title and sections.",
        schema: z.object({
            title: z.string().min(1).describe("Report title"),
            sections: z
                .array(
                    z.object({
                        heading: z.string().min(1).describe("Section heading"),
                        body: z.string().min(1).describe("Section body text"),
                    })
                )
                .min(1)
                .describe("Ordered list of sections"),
        }),
        func: async ({ title, sections }) => {
            const formattedSections = sections
                .map(section => `## ${section.heading}\n${section.body}`)
                .join("\n\n");
            return `# ${title}\n\n${formattedSections}`;
        },
    });
}

export function createSearchDocumentsTool() {
    return new DynamicStructuredTool({
        name: "search_documents",
        description: "Search a collection of documents for a query string.",
        schema: z.object({
            query: z.string().min(1).describe("Search query"),
            documents: z
                .array(
                    z.object({
                        id: z.string().min(1),
                        title: z.string().min(1),
                        content: z.string().min(1),
                    })
                )
                .min(1)
                .describe("Documents to search"),
        }),
        func: async ({ query, documents }) => {
            const normalizedQuery = query.toLowerCase();
            const matches = documents.filter(doc => {
                return doc.title.toLowerCase().includes(normalizedQuery)
                    || doc.content.toLowerCase().includes(normalizedQuery);
            });

            if (matches.length === 0) {
                return `No documents matched "${query}".`;
            }

            const formatted = matches
                .map(doc => `- ${doc.title} (id: ${doc.id})`)
                .join("\n");
            return `Matches for "${query}":\n${formatted}`;
        },
    });
}

export function createConvertFormatTool() {
    return new DynamicStructuredTool({
        name: "convert_format",
        description: "Convert content between markdown and plaintext formats.",
        schema: z.object({
            content: z.string().min(1).describe("Content to convert"),
            fromFormat: z.enum(["markdown", "plaintext"]).describe("Source format"),
            toFormat: z.enum(["markdown", "plaintext"]).describe("Target format"),
        }),
        func: async ({ content, fromFormat, toFormat }) => {
            if (fromFormat === toFormat) {
                return content;
            }

            if (fromFormat === "markdown" && toFormat === "plaintext") {
                const stripped = content
                    .replace(/```([\s\S]*?)```/g, "$1")
                    .replace(/`([^`]+)`/g, "$1")
                    .replace(/[#*_>\-]+/g, " ")
                    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
                    .replace(/\s+/g, " ")
                    .trim();
                return stripped.length > 0 ? stripped : "";
            }

            if (fromFormat === "plaintext" && toFormat === "markdown") {
                return content
                    .split("\n")
                    .map(line => line.trim())
                    .filter(Boolean)
                    .map(line => `- ${line}`)
                    .join("\n");
            }

            return content;
        },
    });
}

export function createAllDocumentAgentTools(): DynamicStructuredTool[] {
    return [
        createSummarizeDocumentTool(),
        createExtractKeyPointsTool(),
        createGenerateReportTool(),
        createSearchDocumentsTool(),
        createConvertFormatTool(),
    ];
}
