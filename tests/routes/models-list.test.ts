import { expect, test } from "../fixtures";
import { expectGuestRedirect, createIsolatedUserContext } from "./utils";
import { generateUUID } from "@/lib/utils";

test.describe("/api/models/list", () => {
  test("anonymous GET is redirected to guest auth", async ({ request }) => {
    const response = await request.get("/api/models/list?provider=google", {
      maxRedirects: 0,
    });

    expectGuestRedirect(response);
  });

  test("provider query parameter is required", async ({ adaContext }) => {
    const response = await adaContext.request.get("/api/models/list");

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(payload.cause).toBe("provider query parameter is required");
  });

  test("unsupported provider returns 400", async ({ adaContext }) => {
    const response = await adaContext.request.get(
      "/api/models/list?provider=banana"
    );

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(payload.cause).toContain("Unsupported provider");
  });

  test("custom provider requires baseUrl", async ({ adaContext }) => {
    const response = await adaContext.request.get(
      "/api/models/list?provider=custom"
    );

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(payload.cause).toBe("baseUrl is required for custom provider");
  });

  test("google provider without apiKey returns 400", async ({ adaContext }) => {
    const response = await adaContext.request.get(
      "/api/models/list?provider=google&agentId=search-agent"
    );

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(typeof payload.message).toBe("string");
  });

  test("unreachable openai-compatible endpoint returns 400", async ({
    adaContext,
  }) => {
    const response = await adaContext.request.get(
      "/api/models/list?provider=lmstudio&baseUrl=http://127.0.0.1:9/v1"
    );

    expect(response.status()).toBe(400);

    const payload = await response.json();
    expect(payload.code).toBe("bad_request:api");
    expect(typeof payload.message).toBe("string");
  });

  test("stored agent config is used when agentId is provided", async ({
    browser,
  }) => {
    const isolated = await createIsolatedUserContext(browser, "models-config");
    const agentId = `models-route-${generateUUID()}`;

    try {
      const saveConfigResponse = await isolated.request.post(
        "/api/user_dashboard/agent-config",
        {
          data: {
            agentId,
            deploymentType: "custom",
            provider: "custom",
            baseUrl: "http://127.0.0.1:9/v1",
          },
        }
      );

      expect(saveConfigResponse.status()).toBe(200);

      const response = await isolated.request.get(
        `/api/models/list?provider=custom&agentId=${agentId}`
      );

      expect(response.status()).toBe(400);

      const payload = await response.json();
      expect(payload.code).toBe("bad_request:api");
      expect(payload.cause).not.toBe("baseUrl is required for custom provider");
    } finally {
      await isolated.request.delete(
        `/api/user_dashboard/agent-config?agentId=${agentId}`
      );
      await isolated.context.close();
    }
  });
});
