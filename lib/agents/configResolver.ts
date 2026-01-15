import { getAgentConfiguration, getAllAgentConfigurations } from "@/lib/db/queries";
import {
  decryptSecret,
  decryptAgentSecrets,
  isEncryptionConfigured,
} from "@/lib/encryption";
import type { LLMImplMetadata, LLMProvider } from "@/lib/types";
import { createHash } from "crypto";

/**
 * Computes a short hash for config caching.
 * Includes both LLM config and secrets since tools depend on secrets.
 */
function computeConfigVersion(
  llmConfig: Partial<LLMImplMetadata>,
  secrets: Record<string, string>
): string {
  // Create deterministic string from config (exclude _configVersion itself)
  const { _configVersion, ...configWithoutVersion } = llmConfig as any;
  const toHash = JSON.stringify({
    config: configWithoutVersion,
    // Only hash secret keys for security, but include presence check
    secretKeys: Object.keys(secrets).sort(),
    // Include a marker if secrets have values (without exposing values)
    hasSecrets: Object.values(secrets).some(v => v && v.length > 0),
  });
  return createHash("sha256").update(toHash).digest("hex").substring(0, 12);
}

/**
 * Recomputes config version after merging subAgentConfigs.
 * Use this for MainAgent to ensure version changes when ANY sub-agent config changes.
 */
export function recomputeConfigVersion(
  llmConfig: Partial<LLMImplMetadata>,
  secrets: Record<string, string>
): string {
  return computeConfigVersion(llmConfig, secrets);
}

export interface ResolvedAgentConfig {
  /**
   * LLM configuration overrides (merged with agent defaults)
   */
  llmConfig: Partial<LLMImplMetadata>;

  /**
   * Agent-specific secrets (e.g., GITHUB_PAT, HF_TOKEN)
   */
  secrets: Record<string, string>;
}

/**
 * Resolves agent configuration for a specific user.
 *
 * This function:
 * 1. Fetches user-specific configuration from the database
 * 2. Decrypts any stored secrets
 * 3. Returns user config overrides (to be merged with agent defaults at runtime)
 * 4. Falls back to environment variables when no user config exists
 *
 * @param userId - The user's ID
 * @param agentId - The agent's ID
 * @returns Resolved configuration with LLM settings and decrypted secrets
 */
/**
 * Resolves agent configuration for a specific user.
 *
 * This function:
 * 1. Fetches user-specific configuration from the database
 * 2. Decrypts any stored secrets
 * 3. Returns user config overrides (to be merged with agent defaults at runtime)
 * 4. Falls back to environment variables when no user config exists
 *
 * @param userId - The user's ID
 * @param agentId - The agent's ID
 * @returns Resolved configuration with LLM settings and decrypted secrets
 */
export async function resolveAgentConfig(
  userId: string,
  agentId: string
): Promise<ResolvedAgentConfig> {
  const result: ResolvedAgentConfig = {
    llmConfig: {},
    secrets: {},
  };

  // If encryption is not configured, we cannot read stored secrets
  if (!isEncryptionConfigured()) {
    console.warn(
      "ENCRYPTION_SECRET not configured - user agent configurations will not be loaded"
    );
    return result;
  }

  try {
    const userConfig = await getAgentConfiguration({ userId, agentId });

    if (!userConfig) {
      // No user-specific config, use defaults
      return result;
    }

    return processAgentConfiguration(userConfig);
  } catch (error) {
    console.error(`Failed to resolve agent config for ${agentId}:`, error);
    return result;
  }
}

/**
 * Resolves configuration for ALL agents for a specific user.
 * 
 * @param userId - The user's ID
 * @returns Map of agentId -> ResolvedAgentConfig
 */
export async function resolveAllAgentConfigs(
  userId: string
): Promise<Record<string, ResolvedAgentConfig>> {
  const result: Record<string, ResolvedAgentConfig> = {};

  if (!isEncryptionConfigured()) {
    return result;
  }

  try {
    const allConfigs = await getAllAgentConfigurations({ userId });

    for (const config of allConfigs) {
      result[config.agentId] = processAgentConfiguration(config);
    }

    return result;
  } catch (error) {
    console.error(`Failed to resolve all agent configs for user ${userId}:`, error);
    return result;
  }
}

/**
 * Helper to process a raw DB configuration into a resolved config
 */
function processAgentConfiguration(userConfig: any): ResolvedAgentConfig {
  const result: ResolvedAgentConfig = {
    llmConfig: {},
    secrets: {},
  };

  // Process deployment type and provider
  if (userConfig.deploymentType === "self-hosted") {
    // Self-hosted: use Ollama provider with custom base URL
    result.llmConfig.provider = "ollama";
    if (userConfig.baseUrl) {
      result.llmConfig.baseURL = userConfig.baseUrl;
    }
    if (userConfig.modelId) {
      result.llmConfig.modelID = userConfig.modelId;
    }
  } else if (userConfig.provider) {
    // Cloud API: use specified provider
    result.llmConfig.provider = userConfig.provider as LLMProvider;

    if (userConfig.modelId) {
      result.llmConfig.modelID = userConfig.modelId;
    }

    // Decrypt and set API key
    if (userConfig.apiKey) {
      try {
        result.llmConfig.apiKey = decryptSecret(userConfig.apiKey);
      } catch (error) {
        console.error(
          `Failed to decrypt API key for agent ${userConfig.agentId}:`,
          error
        );
      }
    }
  }

  // Decrypt agent-specific secrets
  if (userConfig.agentSecrets) {
    try {
      result.secrets = decryptAgentSecrets(userConfig.agentSecrets);
    } catch (error) {
      console.error(
        `Failed to decrypt agent secrets for ${userConfig.agentId}:`,
        error
      );
    }
  }

  // Compute config version for caching (avoids recreating LLM/tools when unchanged)
  result.llmConfig._configVersion = computeConfigVersion(result.llmConfig, result.secrets);

  return result;
}

/**
 * Merges resolved user configuration with agent default configuration.
 *
 * User configuration takes precedence over defaults.
 *
 * @param defaultConfig - The agent's default implementation metadata
 * @param resolvedConfig - The resolved user configuration
 * @returns Merged LLM implementation metadata
 */
export function mergeAgentConfig(
  defaultConfig: LLMImplMetadata,
  resolvedConfig: ResolvedAgentConfig
): LLMImplMetadata {
  return {
    ...defaultConfig,
    ...resolvedConfig.llmConfig,
    // Preserve system instruction from default (users cannot override this)
    systemInstruction: defaultConfig.systemInstruction,
  };
}

/**
 * Gets a specific secret from resolved config, falling back to environment variable.
 *
 * @param resolvedConfig - The resolved configuration
 * @param secretKey - The secret key (e.g., "GITHUB_PAT")
 * @param envVarName - The environment variable name to fall back to
 * @returns The secret value or undefined
 */
export function getSecret(
  resolvedConfig: ResolvedAgentConfig,
  secretKey: string,
  envVarName?: string
): string | undefined {
  // First check user-configured secrets
  if (resolvedConfig.secrets[secretKey]) {
    return resolvedConfig.secrets[secretKey];
  }

  // Fall back to environment variable
  if (envVarName) {
    return process.env[envVarName];
  }

  // Try using secretKey as env var name
  return process.env[secretKey];
}
