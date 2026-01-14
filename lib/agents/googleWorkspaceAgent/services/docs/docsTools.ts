import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { googleApiRequest } from "../../auth/googleAuth";

// Helper to extract text content from a Google Doc
function extractDocText(body: any): string {
    if (!body?.content) return "";

    const textParts: string[] = [];
    for (const element of body.content) {
        if (element.paragraph?.elements) {
            for (const elem of element.paragraph.elements) {
                if (elem.textRun?.content) {
                    textParts.push(elem.textRun.content);
                }
            }
        }
    }
    return textParts.join("");
}

// Docs Create Document Tool
export function createDocsCreateDocumentTool(runtimeSecrets?: Record<string, string>) {
    return new DynamicStructuredTool({
        name: "docs_create_document",
        description: "Create a new Google Doc with an optional initial content.",
        schema: z.object({
            title: z.string().describe("Document title"),
            content: z.string().optional().describe("Initial text content to add to the document"),
        }),
        func: async ({ title, content }) => {
            try {
                // Create the document
                const doc = await googleApiRequest<{ documentId: string; title: string }>(
                    "docs",
                    "/documents",
                    {
                        method: "POST",
                        body: JSON.stringify({ title }),
                    },
                    runtimeSecrets
                );

                // If content provided, add it to the document
                if (content && content.trim()) {
                    await googleApiRequest(
                        "docs",
                        `/documents/${doc.documentId}:batchUpdate`,
                        {
                            method: "POST",
                            body: JSON.stringify({
                                requests: [
                                    {
                                        insertText: {
                                            location: { index: 1 },
                                            text: content,
                                        },
                                    },
                                ],
                            }),
                        },
                        runtimeSecrets
                    );
                }

                return JSON.stringify({
                    status: "success",
                    documentId: doc.documentId,
                    title: doc.title,
                    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
                    message: `Document created: ${doc.title}`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to create document: ${message}` });
            }
        },
    });
}

// Docs Get Document Tool
export function createDocsGetDocumentTool(runtimeSecrets?: Record<string, string>) {
    return new DynamicStructuredTool({
        name: "docs_get_document",
        description: "Get the content of a Google Doc by its ID.",
        schema: z.object({
            documentId: z.string().describe("The document ID to retrieve"),
        }),
        func: async ({ documentId }) => {
            try {
                const doc = await googleApiRequest<{
                    documentId: string;
                    title: string;
                    body: any;
                    revisionId: string;
                }>("docs", `/documents/${encodeURIComponent(documentId)}`, {}, runtimeSecrets);

                const textContent = extractDocText(doc.body);

                return JSON.stringify({
                    status: "success",
                    documentId: doc.documentId,
                    title: doc.title,
                    revisionId: doc.revisionId,
                    content: textContent,
                    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to get document: ${message}` });
            }
        },
    });
}

// Docs Update Document Tool
export function createDocsUpdateDocumentTool(runtimeSecrets?: Record<string, string>) {
    return new DynamicStructuredTool({
        name: "docs_update_document",
        description:
            "Update a Google Doc by inserting, replacing, or deleting text. " +
            "Use insertText to add content at a specific position, or replaceAllText to find and replace.",
        schema: z.object({
            documentId: z.string().describe("The document ID to update"),
            operations: z
                .array(
                    z.object({
                        type: z
                            .enum(["insertText", "replaceAllText", "deleteContent"])
                            .describe("Operation type"),
                        text: z.string().optional().describe("Text to insert or text to search for (replaceAllText)"),
                        replacement: z.string().optional().describe("Replacement text (for replaceAllText)"),
                        index: z.number().optional().describe("Insert position index (for insertText, 1 = start)"),
                        startIndex: z.number().optional().describe("Start index for deletion"),
                        endIndex: z.number().optional().describe("End index for deletion"),
                    })
                )
                .describe("List of operations to perform"),
        }),
        func: async ({ documentId, operations }) => {
            try {
                const requests: any[] = [];

                for (const op of operations) {
                    switch (op.type) {
                        case "insertText":
                            if (op.text && op.index !== undefined) {
                                requests.push({
                                    insertText: {
                                        location: { index: op.index },
                                        text: op.text,
                                    },
                                });
                            }
                            break;
                        case "replaceAllText":
                            if (op.text && op.replacement !== undefined) {
                                requests.push({
                                    replaceAllText: {
                                        containsText: {
                                            text: op.text,
                                            matchCase: true,
                                        },
                                        replaceText: op.replacement,
                                    },
                                });
                            }
                            break;
                        case "deleteContent":
                            if (op.startIndex !== undefined && op.endIndex !== undefined) {
                                requests.push({
                                    deleteContentRange: {
                                        range: {
                                            startIndex: op.startIndex,
                                            endIndex: op.endIndex,
                                        },
                                    },
                                });
                            }
                            break;
                    }
                }

                if (requests.length === 0) {
                    return JSON.stringify({
                        status: "error",
                        message: "No valid operations provided.",
                    });
                }

                await googleApiRequest(
                    "docs",
                    `/documents/${encodeURIComponent(documentId)}:batchUpdate`,
                    {
                        method: "POST",
                        body: JSON.stringify({ requests }),
                    },
                    runtimeSecrets
                );

                return JSON.stringify({
                    status: "success",
                    message: `Document updated with ${requests.length} operation(s).`,
                    documentId,
                    url: `https://docs.google.com/document/d/${documentId}/edit`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to update document: ${message}` });
            }
        },
    });
}

// Export all Docs tools
export function createAllDocsTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
    return [
        createDocsCreateDocumentTool(runtimeSecrets),
        createDocsGetDocumentTool(runtimeSecrets),
        createDocsUpdateDocumentTool(runtimeSecrets),
    ];
}
