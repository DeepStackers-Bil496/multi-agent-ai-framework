import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { AgentsDashboardClient } from "@/components/agents_dashboard/agents-dashboard-client";

export default async function AgentsDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <AgentsDashboardClient />;
}
