import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getDashboardAnalytics, getAgentPreferences } from "@/lib/db/queries";
import { DashboardClient } from "@/components/user_dashboard/dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [analytics, preferences] = await Promise.all([
    getDashboardAnalytics({ userId: session.user.id }),
    getAgentPreferences({ userId: session.user.id }),
  ]);

  return <DashboardClient analytics={analytics} preferences={preferences} />;
}
