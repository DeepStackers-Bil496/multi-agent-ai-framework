import { auth } from "@/app/(auth)/auth";
import { deleteUserToken, type TokenProvider } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const VALID_PROVIDERS: TokenProvider[] = ["github", "google", "custom"];

type RouteContext = {
  params: Promise<{ provider: string }>;
};

/**
 * DELETE /api/settings/tokens/:provider
 * Remove a connected account
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { provider } = await context.params;

  // Validate provider
  if (!VALID_PROVIDERS.includes(provider as TokenProvider)) {
    return new ChatSDKError(
      "bad_request:api",
      `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}`
    ).toResponse();
  }

  try {
    const deleted = await deleteUserToken({
      userId: session.user.id,
      provider: provider as TokenProvider,
    });

    if (!deleted) {
      return new ChatSDKError(
        "not_found:api",
        `No token found for provider: ${provider}`
      ).toResponse();
    }

    return Response.json({
      success: true,
      message: `Token for ${provider} deleted successfully`,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to delete token"
    ).toResponse();
  }
}
