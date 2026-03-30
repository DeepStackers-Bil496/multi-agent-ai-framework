import { expect, test } from "./fixtures";
import { expectGuestRedirect } from "./utils";

test.describe("/api/speech/stt", () => {
  test("anonymous POST is redirected to guest auth", async ({ request }) => {
    const response = await request.post("/api/speech/stt", {
      maxRedirects: 0,
      data: {},
    });

    expectGuestRedirect(response);
  });

  test("authenticated POST with malformed JSON returns 400", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.fetch("/api/speech/stt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: "{not-json",
    });

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(typeof payload.message).toBe("string");
  });

  test("authenticated POST without audio payload returns 400", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/speech/stt", {
      data: {
        mimeType: "audio/webm",
      },
    });

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(typeof payload.message).toBe("string");
  });
});
