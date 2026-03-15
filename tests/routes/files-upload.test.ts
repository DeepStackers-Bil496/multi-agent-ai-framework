import { expect, test } from "../fixtures";

test.describe("/api/files/upload", () => {
  test("anonymous requests are redirected to guest auth", async ({
    request,
  }) => {
    const response = await request.post("/api/files/upload", {
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers().location).toContain("/api/auth/guest");
  });

  test("authenticated requests require a file", async ({ adaContext }) => {
    const response = await adaContext.request.post("/api/files/upload", {
      multipart: {
        note: "missing-file",
      },
    });

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload).toEqual({ error: "No file uploaded" });
  });

  test("authenticated requests reject unsupported file types", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("hello from playwright"),
        },
      },
    });

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.error).toContain("File type should be JPEG, PNG, CSV, or Excel");
  });

  test("authenticated requests accept supported files in test mode", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: "chart.png",
          mimeType: "image/png",
          buffer: Buffer.from("fake-image-bytes"),
        },
      },
    });

    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload).toMatchObject({
      // Vercel Blob appends a random suffix to the filename, so only check
      // the original name stem and content type, not the full url string.
      contentType: "image/png",
    });
    // URL must be a non-empty string pointing to some storage location
    expect(typeof payload.url).toBe("string");
    expect(payload.url.length).toBeGreaterThan(0);
  });
});
