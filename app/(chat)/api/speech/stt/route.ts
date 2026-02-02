import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";

const DEFAULT_GEMINI_STT_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type STTRequestBody = {
  audioBase64?: unknown;
  mimeType?: unknown;
  languageHint?: unknown;
};

function normalizeLanguageHint(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return new ChatSDKError(
      "bad_request:api",
      "GEMINI_API_KEY is not configured"
    ).toResponse();
  }

  let body: STTRequestBody;
  try {
    body = (await request.json()) as STTRequestBody;
  } catch {
    return new ChatSDKError("bad_request:api", "Invalid JSON").toResponse();
  }

  const audioBase64 =
    typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
  const languageHint = normalizeLanguageHint(body.languageHint);

  if (!audioBase64) {
    return new ChatSDKError(
      "bad_request:api",
      "audioBase64 is required"
    ).toResponse();
  }

  if (!mimeType) {
    return new ChatSDKError("bad_request:api", "mimeType is required").toResponse();
  }

  const model = process.env.GEMINI_STT_MODEL || DEFAULT_GEMINI_STT_MODEL;
  const languageInstruction = languageHint
    ? `Use ${languageHint} as a language hint when transcribing if the speech matches it.`
    : "Detect the spoken language automatically.";

  const prompt = [
    "Transcribe the user speech into plain text.",
    languageInstruction,
    "Return only the transcript text.",
    "Do not add explanations, labels, punctuation fixes, markdown, or quotes.",
  ].join(" ");

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new ChatSDKError(
        "bad_request:api",
        errorText || "Gemini STT request failed"
      ).toResponse();
    }

    const data = await response.json();
    const transcript =
      data?.candidates?.[0]?.content?.parts
        ?.filter((part: { text?: unknown }) => typeof part?.text === "string")
        .map((part: { text: string }) => part.text)
        .join(" ")
        .trim() || "";

    if (!transcript) {
      return new ChatSDKError(
        "bad_request:api",
        "No transcript returned from Gemini"
      ).toResponse();
    }

    return Response.json({ transcript });
  } catch (error) {
    return new ChatSDKError(
      "bad_request:api",
      error instanceof Error ? error.message : "Gemini STT request failed"
    ).toResponse();
  }
}
