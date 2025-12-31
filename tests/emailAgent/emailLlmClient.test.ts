import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { draftEmailWithGemini } from "../../lib/agents/emailAgent/llm/emailLlmClient";

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

    const result = await draftEmailWithGemini({ instruction: "Draft a quick note" });

    assert.equal(result.subject, "Hello");
    assert.equal(result.body, "Body");
    assert.equal(captured.input, "https://example.com/gemini?key=test-key");
    assert.ok(captured.init?.body);

    const body = JSON.parse(captured.init?.body as string);
    assert.equal(body.contents[0].role, "user");
});

test("draftEmailWithGemini throws on error response", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    global.fetch = async () =>
        new Response(JSON.stringify({ error: { message: "boom" } }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });

    await assert.rejects(
        () => draftEmailWithGemini({ instruction: "Draft" }),
        /boom/
    );
});
