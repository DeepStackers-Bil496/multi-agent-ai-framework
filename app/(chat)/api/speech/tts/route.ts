import { auth } from "@/app/(auth)/auth";
import { ChatSDKError } from "@/lib/errors";

const DEFAULT_TTS_URL = "http://localhost:8005";
const TTS_TIMEOUT_MS = 60_000;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return new ChatSDKError("bad_request:api", "Invalid JSON").toResponse();
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return new ChatSDKError("bad_request:api", "Text is required").toResponse();
  }

  const ttsUrl = process.env.TTS_SERVER_URL || DEFAULT_TTS_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const response = await fetch(`${ttsUrl}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new ChatSDKError(
        "bad_request:api",
        errorText || "TTS request failed"
      ).toResponse();
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new ChatSDKError("bad_request:api", "TTS request timed out")
        .toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to reach TTS service"
    ).toResponse();
  } finally {
    clearTimeout(timeout);
  }
}
