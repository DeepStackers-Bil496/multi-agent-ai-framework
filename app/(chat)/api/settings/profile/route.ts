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
    profile: profile
      ? {
          fullName: profile.fullName,
          nickname: profile.nickname,
          workType: profile.workType,
          personalPreferences: profile.personalPreferences,
        }
      : null,
  });
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const body = await request.json();
  const { fullName, nickname, workType, personalPreferences } = body;

  // Validate input types
  if (fullName !== undefined && typeof fullName !== "string") {
    return new ChatSDKError(
      "bad_request:api",
      "fullName must be a string"
    ).toResponse();
  }
  if (nickname !== undefined && typeof nickname !== "string") {
    return new ChatSDKError(
      "bad_request:api",
      "nickname must be a string"
    ).toResponse();
  }
  if (workType !== undefined && typeof workType !== "string") {
    return new ChatSDKError(
      "bad_request:api",
      "workType must be a string"
    ).toResponse();
  }
  if (
    personalPreferences !== undefined &&
    typeof personalPreferences !== "string"
  ) {
    return new ChatSDKError(
      "bad_request:api",
      "personalPreferences must be a string"
    ).toResponse();
  }

  const profile = await upsertUserProfile({
    userId: session.user.id,
    fullName,
    nickname,
    workType,
    personalPreferences,
  });

  return Response.json({
    profile: {
      fullName: profile.fullName,
      nickname: profile.nickname,
      workType: profile.workType,
      personalPreferences: profile.personalPreferences,
    },
  });
}
