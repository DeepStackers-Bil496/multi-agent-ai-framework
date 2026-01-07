import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { googleApiRequest, isDryRunMode } from "../../auth/googleAuth";
import { draftEmailWithGemini, DraftEmailInput } from "../../llm/emailLlmClient";
import {
    validateEmailList,
    validateSingleEmail,
    sanitizeHeaderValue,
    ensureHasRecipients,
} from "../../validators/emailValidation";

// Helper to encode email in RFC 2822 format for Gmail API
function createRawEmail(options: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    from?: string;
    replyTo?: string;
    subject: string;
    body: string;
}): string {
    const lines: string[] = [];

    if (options.from) {
        lines.push(`From: ${options.from}`);
    }
    if (options.to.length > 0) {
        lines.push(`To: ${options.to.join(", ")}`);
    }
    if (options.cc && options.cc.length > 0) {
        lines.push(`Cc: ${options.cc.join(", ")}`);
    }
    if (options.bcc && options.bcc.length > 0) {
        lines.push(`Bcc: ${options.bcc.join(", ")}`);
    }
    if (options.replyTo) {
        lines.push(`Reply-To: ${options.replyTo}`);
    }
    lines.push(`Subject: ${options.subject}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("");
    lines.push(options.body);

    const rawMessage = lines.join("\r\n");
    // Base64url encode
    return Buffer.from(rawMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

// Gmail Send Email Tool
export function createGmailSendEmailTool() {
    return new DynamicStructuredTool({
        name: "gmail_send_email",
        description:
            "Send an email via Gmail API. Requires explicit confirmation (confirm=true) before sending. " +
            "Always show the user the email draft and get their confirmation before setting confirm to true.",
        schema: z.object({
            to: z.array(z.string()).optional().describe("Primary recipient email addresses"),
            cc: z.array(z.string()).optional().describe("CC recipient email addresses"),
            bcc: z.array(z.string()).optional().describe("BCC recipient email addresses"),
            from: z.string().optional().describe("Sender email address (must be authorized in Gmail)"),
            replyTo: z.string().optional().describe("Reply-To email address"),
            subject: z.string().describe("Email subject line"),
            body: z.string().describe("Email body text"),
            confirm: z.boolean().describe("Must be true to actually send the email"),
        }),
        func: async ({ to, cc, bcc, from, replyTo, subject, body, confirm }) => {
            try {
                // Validate emails
                const validatedTo = validateEmailList(to, "to");
                const validatedCc = validateEmailList(cc, "cc");
                const validatedBcc = validateEmailList(bcc, "bcc");
                ensureHasRecipients(validatedTo, validatedCc, validatedBcc);

                if (from) {
                    validateSingleEmail(from, "from");
                }
                if (replyTo) {
                    validateSingleEmail(replyTo, "replyTo");
                }

                // Sanitize subject
                const sanitizedSubject = sanitizeHeaderValue(subject, "subject");

                // Check confirmation
                if (!confirm) {
                    return JSON.stringify({
                        status: "needs_confirmation",
                        message: "Email ready to send. Set confirm=true to send.",
                        preview: {
                            to: validatedTo,
                            cc: validatedCc,
                            bcc: validatedBcc,
                            subject: sanitizedSubject,
                            bodyPreview: body.substring(0, 200) + (body.length > 200 ? "..." : ""),
                        },
                    });
                }

                // Check dry run mode
                if (isDryRunMode()) {
                    return JSON.stringify({
                        status: "dry_run",
                        message: "Dry run mode - email not actually sent",
                        payload: {
                            to: validatedTo,
                            cc: validatedCc,
                            bcc: validatedBcc,
                            subject: sanitizedSubject,
                            body,
                        },
                    });
                }

                // Create raw email message
                const raw = createRawEmail({
                    to: validatedTo,
                    cc: validatedCc,
                    bcc: validatedBcc,
                    from,
                    replyTo,
                    subject: sanitizedSubject,
                    body,
                });

                // Send via Gmail API
                const response = await googleApiRequest<{ id: string; threadId: string }>(
                    "gmail",
                    "/users/me/messages/send",
                    {
                        method: "POST",
                        body: JSON.stringify({ raw }),
                    }
                );

                return JSON.stringify({
                    status: "sent",
                    messageId: response.id,
                    threadId: response.threadId,
                    message: `Email sent successfully to ${validatedTo.join(", ")}`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to send email: ${message}` });
            }
        },
    });
}

// Gmail Draft Email Tool (using Gemini)
export function createGmailDraftEmailTool() {
    return new DynamicStructuredTool({
        name: "gmail_draft_email",
        description:
            "Draft an email subject and body using AI (Gemini). " +
            "Returns a draft that must be reviewed before sending with gmail_send_email.",
        schema: z.object({
            instruction: z.string().describe("User request describing what the email should say"),
            to: z.array(z.string()).optional().describe("Primary recipient email addresses"),
            cc: z.array(z.string()).optional().describe("CC recipient email addresses"),
            bcc: z.array(z.string()).optional().describe("BCC recipient email addresses"),
            subjectHint: z.string().optional().describe("Optional hint for the email subject"),
            tone: z.string().optional().describe("Desired tone (professional, friendly, formal, casual)"),
            context: z.string().optional().describe("Additional context to include in the email"),
        }),
        func: async (input: DraftEmailInput) => {
            try {
                const draft = await draftEmailWithGemini(input);
                return JSON.stringify({
                    status: "drafted",
                    subject: draft.subject,
                    body: draft.body,
                    cc: draft.cc,
                    bcc: draft.bcc,
                    message: "Email drafted. Review and use gmail_send_email with confirm=true to send.",
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to draft email: ${message}` });
            }
        },
    });
}

// Gmail Search Emails Tool
export function createGmailSearchEmailsTool() {
    return new DynamicStructuredTool({
        name: "gmail_search_emails",
        description:
            "Search emails in Gmail using Gmail's search syntax. " +
            "Examples: 'from:alice@example.com', 'subject:meeting', 'is:unread', 'after:2024/01/01'",
        schema: z.object({
            query: z.string().describe("Gmail search query (e.g., 'from:alice@example.com is:unread')"),
            maxResults: z.number().int().min(1).max(100).optional().default(10).describe("Maximum emails to return"),
            labelIds: z.array(z.string()).optional().describe("Filter by label IDs (e.g., ['INBOX', 'UNREAD'])"),
        }),
        func: async ({ query, maxResults, labelIds }) => {
            try {
                const params = new URLSearchParams();
                params.set("q", query);
                params.set("maxResults", String(maxResults ?? 10));
                if (labelIds && labelIds.length > 0) {
                    labelIds.forEach((id) => params.append("labelIds", id));
                }

                const response = await googleApiRequest<{
                    messages?: Array<{ id: string; threadId: string }>;
                    resultSizeEstimate?: number;
                }>("gmail", `/users/me/messages?${params.toString()}`);

                if (!response.messages || response.messages.length === 0) {
                    return JSON.stringify({
                        status: "success",
                        message: "No emails found matching the query.",
                        count: 0,
                        emails: [],
                    });
                }

                return JSON.stringify({
                    status: "success",
                    count: response.messages.length,
                    estimatedTotal: response.resultSizeEstimate,
                    emails: response.messages.map((m) => ({
                        id: m.id,
                        threadId: m.threadId,
                    })),
                    message: `Found ${response.messages.length} email(s). Use gmail_get_email with an ID to read details.`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to search emails: ${message}` });
            }
        },
    });
}

// Gmail List Emails Tool
export function createGmailListEmailsTool() {
    return new DynamicStructuredTool({
        name: "gmail_list_emails",
        description: "List emails from Gmail inbox or specific labels.",
        schema: z.object({
            maxResults: z.number().int().min(1).max(100).optional().default(10).describe("Maximum emails to return"),
            labelIds: z.array(z.string()).optional().default(["INBOX"]).describe("Label IDs to filter by"),
            includeSpamTrash: z.boolean().optional().default(false).describe("Include spam and trash"),
        }),
        func: async ({ maxResults, labelIds, includeSpamTrash }) => {
            try {
                const params = new URLSearchParams();
                params.set("maxResults", String(maxResults ?? 10));
                if (labelIds && labelIds.length > 0) {
                    labelIds.forEach((id) => params.append("labelIds", id));
                }
                if (includeSpamTrash) {
                    params.set("includeSpamTrash", "true");
                }

                const response = await googleApiRequest<{
                    messages?: Array<{ id: string; threadId: string }>;
                    resultSizeEstimate?: number;
                }>("gmail", `/users/me/messages?${params.toString()}`);

                if (!response.messages || response.messages.length === 0) {
                    return JSON.stringify({
                        status: "success",
                        message: "No emails found.",
                        count: 0,
                        emails: [],
                    });
                }

                return JSON.stringify({
                    status: "success",
                    count: response.messages.length,
                    emails: response.messages.map((m) => ({
                        id: m.id,
                        threadId: m.threadId,
                    })),
                    message: `Listed ${response.messages.length} email(s). Use gmail_get_email with an ID to read details.`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to list emails: ${message}` });
            }
        },
    });
}

// Gmail Get Email Tool
export function createGmailGetEmailTool() {
    return new DynamicStructuredTool({
        name: "gmail_get_email",
        description: "Get the full content of an email by its ID.",
        schema: z.object({
            emailId: z.string().describe("The email ID to retrieve"),
            format: z
                .enum(["full", "metadata", "minimal"])
                .optional()
                .default("full")
                .describe("Response format: full (all data), metadata (headers only), minimal (IDs only)"),
        }),
        func: async ({ emailId, format }) => {
            try {
                const params = new URLSearchParams();
                params.set("format", format ?? "full");

                const response = await googleApiRequest<{
                    id: string;
                    threadId: string;
                    labelIds?: string[];
                    snippet?: string;
                    payload?: {
                        headers?: Array<{ name: string; value: string }>;
                        body?: { data?: string };
                        parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
                    };
                    internalDate?: string;
                }>("gmail", `/users/me/messages/${encodeURIComponent(emailId)}?${params.toString()}`);

                // Extract headers
                const headers = response.payload?.headers || [];
                const getHeader = (name: string) =>
                    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

                // Extract body
                let body = "";
                if (response.payload?.body?.data) {
                    body = Buffer.from(response.payload.body.data, "base64").toString("utf-8");
                } else if (response.payload?.parts) {
                    const textPart = response.payload.parts.find(
                        (p) => p.mimeType === "text/plain" && p.body?.data
                    );
                    if (textPart?.body?.data) {
                        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
                    }
                }

                return JSON.stringify({
                    status: "success",
                    email: {
                        id: response.id,
                        threadId: response.threadId,
                        labels: response.labelIds,
                        from: getHeader("From"),
                        to: getHeader("To"),
                        cc: getHeader("Cc"),
                        subject: getHeader("Subject"),
                        date: getHeader("Date"),
                        snippet: response.snippet,
                        body: body || "(No plain text body found)",
                    },
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to get email: ${message}` });
            }
        },
    });
}

// Gmail Delete Email Tool
export function createGmailDeleteEmailTool() {
    return new DynamicStructuredTool({
        name: "gmail_delete_email",
        description: "Move an email to trash by its ID. This does not permanently delete the email.",
        schema: z.object({
            emailId: z.string().describe("The email ID to move to trash"),
        }),
        func: async ({ emailId }) => {
            try {
                await googleApiRequest<{ id: string }>(
                    "gmail",
                    `/users/me/messages/${encodeURIComponent(emailId)}/trash`,
                    { method: "POST" }
                );

                return JSON.stringify({
                    status: "success",
                    message: `Email ${emailId} moved to trash.`,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return JSON.stringify({ status: "error", message: `Failed to delete email: ${message}` });
            }
        },
    });
}

// Export all Gmail tools
export function createAllGmailTools(): DynamicStructuredTool[] {
    return [
        createGmailSendEmailTool(),
        createGmailDraftEmailTool(),
        createGmailSearchEmailsTool(),
        createGmailListEmailsTool(),
        createGmailGetEmailTool(),
        createGmailDeleteEmailTool(),
    ];
}
