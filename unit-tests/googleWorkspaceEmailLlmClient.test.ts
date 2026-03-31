import { afterEach, test, expect } from "vitest";
import { draftEmailWithGemini } from "@/lib/agents/googleWorkspaceAgent/llm/emailLlmClient";

const originalFetch = global.fetch;
const originalApiKey = process.env.GEMINI_API_KEY;
const originalEndpoint = process.env.EMAIL_LLM_ENDPOINT;

afterEach(() => {
  global.fetch = originalFetch;
  process.env.GEMINI_API_KEY = originalApiKey;
  process.env.EMAIL_LLM_ENDPOINT = originalEndpoint;
});

test("draftEmailWithGemini sends request and parses response", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.EMAIL_LLM_ENDPOINT = "https://example.com/gemini";

  let captured: { input?: RequestInfo | URL; init?: RequestInit } = {};

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = { input, init };
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: '{"subject":"Hello","body":"Body"}' }],
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const result = await draftEmailWithGemini({
    instruction: "Draft a quick note",
  });

  expect(result.subject).toBe("Hello");
  expect(result.body).toBe("Body");
  expect(captured.input).toBe("https://example.com/gemini?key=test-key");
  expect(captured.init?.body).toBeTruthy();

  const body = JSON.parse(captured.init?.body as string);
  expect(body.contents[0].role).toBe("user");
});

test("draftEmailWithGemini throws on error response", async () => {
  process.env.GEMINI_API_KEY = "test-key";

  global.fetch = async () =>
    new Response(JSON.stringify({ error: { message: "boom" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });

  await expect(
    draftEmailWithGemini({ instruction: "Draft" })
  ).rejects.toThrow(/boom/);
});
