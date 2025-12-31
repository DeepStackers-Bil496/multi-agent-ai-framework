import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { draftEmailWithGemini } from "./llm/emailLlmClient";
import { sendEmail, sendEmailSchema } from "./tools/sendEmail";

const draftEmailSchema = z.object({
    instruction: z.string().describe("User request for the email draft"),
    to: z.array(z.string()).optional().describe("Primary recipients"),
    cc: z.array(z.string()).optional().describe("CC recipients"),
    bcc: z.array(z.string()).optional().describe("BCC recipients"),
    subjectHint: z.string().optional().describe("Optional subject hint"),
    tone: z.string().optional().describe("Desired tone, e.g., professional, friendly"),
    context: z.string().optional().describe("Additional context to include"),
});

export function createDraftEmailTool() {
    return new DynamicStructuredTool({
        name: "draft_email_with_gemini",
        description: "Draft an email subject and body using Gemini. Returns JSON with subject/body.",
        schema: draftEmailSchema,
        func: async (input) => {
            const draft = await draftEmailWithGemini(input);
            return JSON.stringify(draft);
        },
    });
}

export function createSendEmailTool() {
    return new DynamicStructuredTool({
        name: "send_email",
        description: "Send an email via SMTP. Requires confirm=true and validated recipients.",
        schema: sendEmailSchema,
        func: async (input) => {
            const result = await sendEmail(input);
            return JSON.stringify(result);
        },
    });
}

export function createAllEmailAgentTools(): DynamicStructuredTool[] {
    return [createDraftEmailTool(), createSendEmailTool()];
}
