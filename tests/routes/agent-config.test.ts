import { getMessageByErrorCode } from "@/lib/errors";
import { expect, test } from "../fixtures";

const AGENT_ID = "search-agent";

test.describe.serial("/api/user_dashboard/agent-config", () => {
  test("anonymous requests are redirected to guest auth", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/user_dashboard/agent-config?agentId=${AGENT_ID}`,
      { maxRedirects: 0 }
    );

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers().location).toContain("/api/auth/guest");
  });

  test("agentId is required for GET", async ({ adaContext }) => {
    const response = await adaContext.request.get(
      "/api/user_dashboard/agent-config"
    );

    expect(response.status()).toBe(400);

    const { code, message } = await response.json();
    expect(code).toBe("bad_request:api");
    expect(message).toBe("agentId query parameter is required");
  });

  test("returns null when no configuration exists", async ({ adaContext }) => {
    const response = await adaContext.request.get(
      `/api/user_dashboard/agent-config?agentId=${AGENT_ID}`
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ config: null });
  });

  test("rejects invalid deployment types", async ({ adaContext }) => {
    const response = await adaContext.request.post(
      "/api/user_dashboard/agent-config",
      {
        data: {
          agentId: AGENT_ID,
          deploymentType: "invalid",
        },
      }
    );

    expect(response.status()).toBe(400);

    const { code, message } = await response.json();
    expect(code).toBe("bad_request:api");
    expect(message).toBe(
      "deploymentType must be 'cloud', 'self-hosted', or 'custom'"
    );
  });

  test("Ada can save and read masked agent configuration", async ({
    adaContext,
  }) => {
    const saveResponse = await adaContext.request.post(
      "/api/user_dashboard/agent-config",
      {
        data: {
          agentId: AGENT_ID,
          deploymentType: "custom",
          provider: "ollama",
          modelId: "llama3.1:8b",
          apiKey: "test-api-key",
          baseUrl: "http://localhost:11434/v1",
          chatTemplate: "{{messages}}",
          customTemplate: "custom-template",
          agentSecrets: {
            SERPER_API_KEY: "serper-secret",
          },
        },
      }
    );

    expect(saveResponse.status()).toBe(200);
    expect(await saveResponse.json()).toEqual({ success: true });

    const readResponse = await adaContext.request.get(
      `/api/user_dashboard/agent-config?agentId=${AGENT_ID}`
    );

    expect(readResponse.status()).toBe(200);

    const payload = await readResponse.json();
    expect(payload.config).toMatchObject({
      deploymentType: "custom",
      provider: "ollama",
      modelId: "llama3.1:8b",
      hasApiKey: true,
      baseUrl: "http://localhost:11434/v1",
      chatTemplate: "{{messages}}",
      customTemplate: "custom-template",
      hasAgentSecrets: true,
      configuredSecrets: ["SERPER_API_KEY"],
    });
    expect(payload.config).not.toHaveProperty("apiKey");
    expect(payload.config).not.toHaveProperty("agentSecrets");
  });

  test("Babbage cannot see Ada's agent configuration", async ({
    babbageContext,
  }) => {
    const response = await babbageContext.request.get(
      `/api/user_dashboard/agent-config?agentId=${AGENT_ID}`
    );

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ config: null });
  });

  test("agentId is required for DELETE", async ({ adaContext }) => {
    const response = await adaContext.request.delete(
      "/api/user_dashboard/agent-config"
    );

    expect(response.status()).toBe(400);

    const { code, message } = await response.json();
    expect(code).toBe("bad_request:api");
    expect(message).toBe("agentId query parameter is required");
  });

  test("Ada can delete her saved configuration", async ({ adaContext }) => {
    const deleteResponse = await adaContext.request.delete(
      `/api/user_dashboard/agent-config?agentId=${AGENT_ID}`
    );

    expect(deleteResponse.status()).toBe(200);
    expect(await deleteResponse.json()).toEqual({ success: true });

    const readResponse = await adaContext.request.get(
      `/api/user_dashboard/agent-config?agentId=${AGENT_ID}`
    );

    expect(readResponse.status()).toBe(200);
    expect(await readResponse.json()).toEqual({ config: null });
  });
});
