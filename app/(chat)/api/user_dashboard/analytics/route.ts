import { auth } from "@/app/(auth)/auth";
import { getDashboardAnalytics } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const analytics = await getDashboardAnalytics({ userId: session.user.id });

  return Response.json(analytics);
}
