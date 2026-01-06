import { auth } from "@/app/(auth)/auth";
import { getAgentPreferences, upsertAgentPreference } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const preferences = await getAgentPreferences({ userId: session.user.id });

  return Response.json({ preferences });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { agentId, enabled } = body;

  if (typeof agentId !== "string" || typeof enabled !== "boolean") {
    return new ChatSDKError(
      "bad_request:api",
      "agentId (string) and enabled (boolean) are required"
    ).toResponse();
  }

  await upsertAgentPreference({
    userId: session.user.id,
    agentId,
    enabled,
  });

  return Response.json({ success: true });
}
