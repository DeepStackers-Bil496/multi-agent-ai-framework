import { auth } from "@/app/(auth)/auth";
import { getUserProfile, upsertUserProfile } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const profile = await getUserProfile({ userId: session.user.id });

  return Response.json({
    notifications: {
      notifyResponseCompletions: profile?.notifyResponseCompletions ?? true,
      notifyEmails: profile?.notifyEmails ?? false,
    },
  });
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { notifyResponseCompletions, notifyEmails } = body;

  // Validate input types
  if (
    notifyResponseCompletions !== undefined &&
    typeof notifyResponseCompletions !== "boolean"
  ) {
    return new ChatSDKError(
      "bad_request:api",
      "notifyResponseCompletions must be a boolean"
    ).toResponse();
  }
  if (notifyEmails !== undefined && typeof notifyEmails !== "boolean") {
    return new ChatSDKError(
      "bad_request:api",
      "notifyEmails must be a boolean"
    ).toResponse();
  }

  const profile = await upsertUserProfile({
    userId: session.user.id,
    notifyResponseCompletions,
    notifyEmails,
  });

  return Response.json({
    notifications: {
      notifyResponseCompletions: profile.notifyResponseCompletions,
      notifyEmails: profile.notifyEmails,
    },
  });
}
