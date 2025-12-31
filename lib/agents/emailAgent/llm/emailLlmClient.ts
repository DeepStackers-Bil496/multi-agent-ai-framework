const DEFAULT_MODEL_ID = "gemini-1.5-flash";
const DEFAULT_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 15000;

export type DraftEmailInput = {
    instruction: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subjectHint?: string;
    tone?: string;
    context?: string;
};

export type DraftEmailOutput = {
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
};

type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
    error?: { message?: string };
};

const buildPrompt = (input: DraftEmailInput) => {
    const recipients = {
        to: input.to?.join(", ") || "",
        cc: input.cc?.join(", ") || "",
        bcc: input.bcc?.join(", ") || "",
    };

    return `You are an email drafting assistant. Produce a JSON object ONLY with keys:\n` +
        `subject (string), body (string), cc (array, optional), bcc (array, optional).\n` +
        `No markdown, no code fences.\n\n` +
        `Instruction: ${input.instruction}\n` +
        `Tone: ${input.tone || "professional"}\n` +
        `Subject hint: ${input.subjectHint || ""}\n` +
        `To: ${recipients.to}\n` +
        `Cc: ${recipients.cc}\n` +
        `Bcc: ${recipients.bcc}\n` +
        `Context: ${input.context || ""}`;
};

const extractText = (response: GeminiResponse): string => {
    return response?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim() || "";
};

const extractJson = (text: string): DraftEmailOutput => {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Gemini response did not include JSON output.");
    }
    return JSON.parse(jsonMatch[0]) as DraftEmailOutput;
};

export async function draftEmailWithGemini(input: DraftEmailInput): Promise<DraftEmailOutput> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.EMAIL_LLM_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is required for email drafting.");
    }

    const endpointOverride = process.env.EMAIL_LLM_ENDPOINT;
    const modelId = DEFAULT_MODEL_ID;
    const endpoint = endpointOverride || `${DEFAULT_ENDPOINT_BASE}/${modelId}:generateContent`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${endpoint}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: buildPrompt(input) }],
                    },
                ],
            }),
            signal: controller.signal,
        });

        const data = (await response.json()) as GeminiResponse;

        if (!response.ok) {
            const errorMessage = data.error?.message || `Gemini request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        const text = extractText(data);
        if (!text) {
            throw new Error("Gemini returned an empty response.");
        }

        const output = extractJson(text);
        if (!output.subject || !output.body) {
            throw new Error("Gemini response missing subject or body.");
        }

        return output;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error("Gemini request timed out.");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
