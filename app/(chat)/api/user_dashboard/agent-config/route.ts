import { auth } from "@/app/(auth)/auth";
import {
  deleteAgentConfiguration,
  getAgentConfiguration,
} from "@/lib/db/queries";
import {
  encryptSecret,
  encryptAgentSecrets,
  decryptAgentSecrets,
  isEncryptionConfigured,
} from "@/lib/encryption";
import { ChatSDKError } from "@/lib/errors";
import { upsertAgentConfiguration } from "@/lib/db/queries";

/**
 * GET /api/user_dashboard/agent-config?agentId=xxx
 * Retrieves configuration for a specific agent.
 * Returns field existence indicators, not raw secrets.
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return new ChatSDKError(
      "bad_request:api",
      "agentId query parameter is required"
    ).toResponse();
  }

  const config = await getAgentConfiguration({
    userId: session.user.id,
    agentId,
  });

  if (!config) {
    return Response.json({ config: null });
  }

  // Parse configured secrets to return which keys exist (not values)
  let configuredSecrets: string[] = [];
  if (config.agentSecrets) {
    try {
      const secrets = decryptAgentSecrets(config.agentSecrets);
      configuredSecrets = Object.keys(secrets);
    } catch {
      // If decryption fails, return empty array
      configuredSecrets = [];
    }
  }

  // Return config WITHOUT decrypted secrets - just indicate if they exist
  return Response.json({
    config: {
      deploymentType: config.deploymentType,
      provider: config.provider,
      modelId: config.modelId,
      hasApiKey: !!config.apiKey,
      baseUrl: config.baseUrl,
      chatTemplate: config.chatTemplate,
      customTemplate: config.customTemplate,
      hasAgentSecrets: !!config.agentSecrets,
      configuredSecrets,
    },
  });
}

/**
 * POST /api/user_dashboard/agent-config
 * Create or update configuration for an agent.
 * Encrypts sensitive data before storage.
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  // Check encryption is configured for storing secrets
  if (!isEncryptionConfigured()) {
    return new ChatSDKError(
      "bad_request:api",
      "Server encryption is not configured. Contact administrator."
    ).toResponse();
  }

  const body = await request.json();
  const {
    agentId,
    deploymentType,
    provider,
    modelId,
    apiKey,
    baseUrl,
    chatTemplate,
    customTemplate,
    agentSecrets,
  } = body;

  if (typeof agentId !== "string") {
    return new ChatSDKError(
      "bad_request:api",
      "agentId (string) is required"
    ).toResponse();
  }

  // Validate deploymentType
  if (deploymentType && !["cloud", "self-hosted", "custom"].includes(deploymentType)) {
    return new ChatSDKError(
      "bad_request:api",
      "deploymentType must be 'cloud', 'self-hosted', or 'custom'"
    ).toResponse();
  }

  // Encrypt sensitive data before storage
  let encryptedApiKey: string | null = null;
  let encryptedSecrets: string | null = null;

  if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
    encryptedApiKey = encryptSecret(apiKey.trim());
  }

  if (
    agentSecrets &&
    typeof agentSecrets === "object" &&
    Object.keys(agentSecrets).length > 0
  ) {
    // Filter out empty values
    const filteredSecrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(agentSecrets)) {
      if (typeof value === "string" && value.trim()) {
        filteredSecrets[key] = value.trim();
      }
    }

    if (Object.keys(filteredSecrets).length > 0) {
      // Merge with existing secrets if any
      const existingConfig = await getAgentConfiguration({
        userId: session.user.id,
        agentId,
      });

      let mergedSecrets = filteredSecrets;
      if (existingConfig?.agentSecrets) {
        try {
          const existing = decryptAgentSecrets(existingConfig.agentSecrets);
          mergedSecrets = { ...existing, ...filteredSecrets };
        } catch {
          // If decryption fails, just use new secrets
        }
      }

      encryptedSecrets = encryptAgentSecrets(mergedSecrets);
    }
  }

  await upsertAgentConfiguration({
    userId: session.user.id,
    agentId,
    deploymentType: deploymentType || undefined,
    provider: provider || undefined,
    modelId: modelId || undefined,
    // Only pass apiKey if user entered a new one (not empty)
    apiKey: encryptedApiKey ?? undefined,
    baseUrl: baseUrl || undefined,
    // Chat template configuration for custom deployment
    chatTemplate: chatTemplate || undefined,
    customTemplate: customTemplate || undefined,
    // Only pass agentSecrets if user entered new secrets (merged with existing)
    agentSecrets: encryptedSecrets ?? undefined,
  });

  return Response.json({ success: true });
}

/**
 * DELETE /api/user_dashboard/agent-config?agentId=xxx
 * Removes configuration for an agent (resets to defaults).
 */
export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId) {
    return new ChatSDKError(
      "bad_request:api",
      "agentId query parameter is required"
    ).toResponse();
  }

  await deleteAgentConfiguration({
    userId: session.user.id,
    agentId,
  });

  return Response.json({ success: true });
}
