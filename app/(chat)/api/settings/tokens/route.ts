import { auth } from "@/app/(auth)/auth";
import {
  getUserTokens,
  saveUserToken,
  type TokenProvider,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const VALID_PROVIDERS: TokenProvider[] = ["github", "google", "custom"];

/**
 * GET /api/settings/tokens
 * List all connected accounts (without exposing actual tokens)
 */
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const tokens = await getUserTokens({ userId: session.user.id });

    return Response.json({
      tokens: tokens.map((token) => ({
        id: token.id,
        provider: token.provider,
        scopes: token.scopes,
        metadata: token.metadata,
        expiresAt: token.expiresAt?.toISOString() || null,
        createdAt: token.createdAt.toISOString(),
        updatedAt: token.updatedAt.toISOString(),
        isExpired: token.isExpired,
      })),
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError("bad_request:api", "Failed to get tokens").toResponse();
  }
}

/**
 * POST /api/settings/tokens
 * Store a new token (encrypts before storage)
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  let body: {
    provider?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    scopes?: string[];
    metadata?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch (_error) {
    return new ChatSDKError(
      "bad_request:api",
      "Invalid JSON body"
    ).toResponse();
  }

  const { provider, accessToken, refreshToken, expiresAt, scopes, metadata } =
    body;

  // Validate provider
  if (!provider || !VALID_PROVIDERS.includes(provider as TokenProvider)) {
    return new ChatSDKError(
      "bad_request:api",
      `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`
    ).toResponse();
  }

  // Validate accessToken
  if (!accessToken || typeof accessToken !== "string") {
    return new ChatSDKError(
      "bad_request:api",
      "accessToken is required and must be a string"
    ).toResponse();
  }

  // Validate optional fields
  if (
    refreshToken !== undefined &&
    refreshToken !== null &&
    typeof refreshToken !== "string"
  ) {
    return new ChatSDKError(
      "bad_request:api",
      "refreshToken must be a string or null"
    ).toResponse();
  }

  if (scopes !== undefined && !Array.isArray(scopes)) {
    return new ChatSDKError(
      "bad_request:api",
      "scopes must be an array of strings"
    ).toResponse();
  }

  if (
    metadata !== undefined &&
    (typeof metadata !== "object" || Array.isArray(metadata))
  ) {
    return new ChatSDKError(
      "bad_request:api",
      "metadata must be an object"
    ).toResponse();
  }

  // Parse expiresAt if provided
  let parsedExpiresAt: Date | null = null;
  if (expiresAt) {
    parsedExpiresAt = new Date(expiresAt);
    if (Number.isNaN(parsedExpiresAt.getTime())) {
      return new ChatSDKError(
        "bad_request:api",
        "expiresAt must be a valid date string"
      ).toResponse();
    }
  }

  try {
    const result = await saveUserToken({
      userId: session.user.id,
      provider: provider as TokenProvider,
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt: parsedExpiresAt,
      scopes: scopes || [],
      metadata: metadata || {},
    });

    return Response.json({
      success: true,
      id: result.id,
      message: `Token for ${provider} saved successfully`,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to save token"
    ).toResponse();
  }
}
