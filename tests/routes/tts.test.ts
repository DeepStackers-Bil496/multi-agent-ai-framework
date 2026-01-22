import { getMessageByErrorCode } from "@/lib/errors";
import { expect, test } from "../fixtures";

test.describe("/api/speech/tts", () => {
  test("rejects unauthenticated requests", async ({ browser }) => {
    const context = await browser.newContext();
    const response = await context.request.post("/api/speech/tts", {
      data: { text: "Merhaba" },
    });

    expect(response.status()).toBe(401);
    const { code, message } = await response.json();
    expect(code).toBe("unauthorized:chat");
    expect(message).toBe(getMessageByErrorCode("unauthorized:chat"));

    await context.close();
  });

  test("rejects empty text", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/speech/tts", {
      data: { text: "   " },
    });

    expect(response.status()).toBe(400);
    const { code, message, cause } = await response.json();
    expect(code).toBe("bad_request:api");
    expect(message).toBe(getMessageByErrorCode("bad_request:api"));
    expect(cause).toBe("Text is required");
  });
});
