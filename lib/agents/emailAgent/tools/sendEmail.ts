import { z } from "zod";
import { sanitizeHeaderValue, validateEmailList, validateSingleEmail, ensureHasRecipients } from "../validators/emailValidation";

export const sendEmailSchema = z.object({
    to: z.array(z.string()).optional().describe("Primary recipient emails"),
    cc: z.array(z.string()).optional().describe("CC recipient emails"),
    bcc: z.array(z.string()).optional().describe("BCC recipient emails"),
    from: z.string().optional().describe("From email address (optional, defaults to DEFAULT_FROM)"),
    replyTo: z.string().optional().describe("Reply-To email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body text"),
    confirm: z.boolean().describe("Must be true to send the email"),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

type SendEmailResult =
    | { status: "needs_confirmation"; message: string }
    | { status: "dry_run"; payload: Record<string, unknown> }
    | { status: "sent"; messageId: string | undefined; payload: Record<string, unknown> };

const isDryRun = () => process.env.EMAIL_DRY_RUN?.toLowerCase() === "true";

const getSmtpConfig = () => {
    const host = process.env.SMTP_HOST || "";
    const port = Number(process.env.SMTP_PORT || "0");
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const secure = process.env.SMTP_SECURE?.toLowerCase() === "true";
    const from = process.env.DEFAULT_FROM || "";

    return { host, port, user, pass, secure, from };
};

type Transporter = {
    sendMail: (payload: Record<string, unknown>) => Promise<{ messageId?: string }>;
};

const createDefaultTransport = async (): Promise<Transporter> => {
    const nodemailer = await import("nodemailer");
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || "0"),
        secure: process.env.SMTP_SECURE?.toLowerCase() === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

export async function sendEmail(
    input: SendEmailInput,
    transportFactory: () => Promise<Transporter> = createDefaultTransport
): Promise<SendEmailResult> {
    if (!input.confirm) {
        return {
            status: "needs_confirmation",
            message: "Confirmation required before sending the email.",
        };
    }

    const to = validateEmailList(input.to, "to");
    const cc = validateEmailList(input.cc, "cc");
    const bcc = validateEmailList(input.bcc, "bcc");
    ensureHasRecipients(to, cc, bcc);

    const smtpConfig = getSmtpConfig();
    const fromValue = input.from || smtpConfig.from;
    if (!fromValue) {
        throw new Error("DEFAULT_FROM must be set to send emails.");
    }
    const from = sanitizeHeaderValue(validateSingleEmail(fromValue, "from"), "from");
    const subject = sanitizeHeaderValue(input.subject, "subject");
    const replyTo = input.replyTo
        ? sanitizeHeaderValue(validateSingleEmail(input.replyTo, "replyTo"), "replyTo")
        : undefined;

    const payload = {
        from,
        to: to.length ? to : undefined,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject,
        text: input.body,
        replyTo,
    };

    if (isDryRun()) {
        return {
            status: "dry_run",
            payload,
        };
    }

    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
        throw new Error("SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
    }

    const transport = await transportFactory();
    const info = await transport.sendMail(payload);

    return {
        status: "sent",
        messageId: info?.messageId,
        payload,
    };
}
