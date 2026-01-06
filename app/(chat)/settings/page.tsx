import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { SettingsLayout } from "@/components/settings/settings-layout";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <SettingsLayout />;
}
