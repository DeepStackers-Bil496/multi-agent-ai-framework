import { auth } from "@/app/(auth)/auth";
import { getAgentConfiguration } from "@/lib/db/queries";
import { decryptSecret } from "@/lib/encryption";
import { ChatSDKError } from "@/lib/errors";
import type { LLMProvider } from "@/lib/types";

interface ModelInfo {
    id: string;
    name: string;
}

interface ListModelsResponse {
    models: ModelInfo[];
}

/**
 * GET /api/models/list
 * Fetches available models from a specific provider.
 *
 * Query params:
 * - provider: google | openai | anthropic | groq | mistral | ollama
 * - apiKey: API key (optional if agentId is provided and key is stored)
 * - agentId: Agent ID to fetch stored API key from database (optional)
 * - baseUrl: Required for ollama (self-hosted)
 */
export async function GET(request: Request) {
    const session = await auth();

    if (!session?.user) {
        return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") as LLMProvider | null;
    let apiKey = searchParams.get("apiKey");
    const agentId = searchParams.get("agentId");
    let baseUrl = searchParams.get("baseUrl");

    if (!provider) {
        return new ChatSDKError(
            "bad_request:api",
            "provider query parameter is required"
        ).toResponse();
    }

    // If agentId is provided and no apiKey, try to fetch stored API key from database
    if (agentId && !apiKey) {
        try {
            const config = await getAgentConfiguration({
                userId: session.user.id,
                agentId,
            });

            if (config?.apiKey) {
                apiKey = decryptSecret(config.apiKey);
            }

            // Also get baseUrl from config if not provided
            if (config?.baseUrl && !baseUrl) {
                baseUrl = config.baseUrl;
            }
        } catch (error) {
            console.error("Error fetching agent configuration:", error);
            // Continue without stored key - will error if apiKey is required
        }
    }

    try {
        let models: ModelInfo[];

        switch (provider) {
            case "google":
                models = await fetchGoogleModels(apiKey);
                break;
            case "openai":
                models = await fetchOpenAIModels(apiKey);
                break;
            case "anthropic":
                models = await fetchAnthropicModels(apiKey);
                break;
            case "groq":
                models = await fetchGroqModels(apiKey);
                break;
            case "mistral":
                models = await fetchMistralModels(apiKey);
                break;
            case "ollama":
                models = await fetchOllamaModels(baseUrl);
                break;
            default:
                return new ChatSDKError(
                    "bad_request:api",
                    `Unsupported provider: ${provider}`
                ).toResponse();
        }

        return Response.json({ models } satisfies ListModelsResponse);
    } catch (error) {
        console.error(`Error fetching models for ${provider}:`, error);
        return new ChatSDKError(
            "bad_request:api",
            error instanceof Error ? error.message : "Failed to fetch models"
        ).toResponse();
    }
}

/**
 * Fetch models from Google Generative AI API
 */
async function fetchGoogleModels(apiKey: string | null): Promise<ModelInfo[]> {
    if (!apiKey) {
        throw new Error("API key is required for Google");
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${error}`);
    }

    const data = await response.json();

    // Filter for generative models and format response
    return (data.models || [])
        .filter((model: { name: string }) =>
            model.name.includes("gemini")
        )
        .map((model: { name: string; displayName?: string }) => ({
            id: model.name.replace("models/", ""),
            name: model.displayName || model.name.replace("models/", ""),
        }));
}

/**
 * Fetch models from OpenAI API
 */
async function fetchOpenAIModels(apiKey: string | null): Promise<ModelInfo[]> {
    if (!apiKey) {
        throw new Error("API key is required for OpenAI");
    }

    const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();

    // Filter for chat models (gpt-*) and sort by name
    return (data.data || [])
        .filter((model: { id: string }) =>
            model.id.startsWith("gpt-") || model.id.startsWith("o")
        )
        .map((model: { id: string }) => ({
            id: model.id,
            name: model.id,
        }))
        .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
}

/**
 * Fetch models from Anthropic API
 */
async function fetchAnthropicModels(
    apiKey: string | null
): Promise<ModelInfo[]> {
    if (!apiKey) {
        throw new Error("API key is required for Anthropic");
    }

    const response = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();

    return (data.data || []).map((model: { id: string; display_name?: string }) => ({
        id: model.id,
        name: model.display_name || model.id,
    }));
}

/**
 * Fetch models from Groq API
 */
async function fetchGroqModels(apiKey: string | null): Promise<ModelInfo[]> {
    if (!apiKey) {
        throw new Error("API key is required for Groq");
    }

    const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${error}`);
    }

    const data = await response.json();

    return (data.data || []).map((model: { id: string }) => ({
        id: model.id,
        name: model.id,
    }));
}

/**
 * Fetch models from Mistral API
 */
async function fetchMistralModels(apiKey: string | null): Promise<ModelInfo[]> {
    if (!apiKey) {
        throw new Error("API key is required for Mistral");
    }

    const response = await fetch("https://api.mistral.ai/v1/models", {
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Mistral API error: ${error}`);
    }

    const data = await response.json();

    return (data.data || []).map((model: { id: string; name?: string }) => ({
        id: model.id,
        name: model.name || model.id,
    }));
}

/**
 * Fetch models from Ollama (self-hosted)
 */
async function fetchOllamaModels(baseUrl: string | null): Promise<ModelInfo[]> {
    if (!baseUrl) {
        throw new Error("Base URL is required for Ollama");
    }

    // Normalize URL - remove trailing slash if present
    const normalizedUrl = baseUrl.replace(/\/$/, "");

    const response = await fetch(`${normalizedUrl}/api/tags`);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${error}`);
    }

    const data = await response.json();

    return (data.models || []).map((model: { name: string; model?: string }) => ({
        id: model.model || model.name,
        name: model.name,
    }));
}
