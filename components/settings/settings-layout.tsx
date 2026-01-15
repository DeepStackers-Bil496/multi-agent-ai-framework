"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Settings,
  User,
  Shield,
  BarChart3,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GeneralTab } from "./tabs/general-tab";
import { AccountTab } from "./tabs/account-tab";
import { PrivacyTab } from "./tabs/privacy-tab";
import { UsageTab } from "./tabs/usage-tab";
import { CapabilitiesTab } from "./tabs/capabilities-tab";

const tabs = [
  { id: "general", label: "General", icon: Settings },
  { id: "account", label: "Account", icon: User },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "capabilities", label: "Capabilities", icon: Sparkles },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const router = useRouter();

  const renderContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralTab />;
      case "account":
        return <AccountTab />;
      case "privacy":
        return <PrivacyTab />;
      case "usage":
        return <UsageTab />;
      case "capabilities":
        return <CapabilitiesTab />;
      default:
        return <GeneralTab />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-muted/30 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>

        <nav className="flex flex-col gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
