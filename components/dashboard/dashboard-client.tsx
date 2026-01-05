"use client";

import { motion } from "framer-motion";
import { StatsOverview } from "./stats-overview";
import { UsageCharts } from "./usage-charts";
import { AgentToggles } from "./agent-toggles";
import { RecentActivity } from "./recent-activity";
import type { AgentPreference } from "@/lib/db/schema";

interface DashboardAnalytics {
  summary: {
    totalChats: number;
    totalMessages: number;
    totalTokens: number;
  };
  recentChats: {
    id: string;
    title: string;
    createdAt: string;
  }[];
  messagesPerDay: {
    date: string;
    count: number;
  }[];
}

interface DashboardClientProps {
  analytics: DashboardAnalytics;
  preferences: AgentPreference[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

export function DashboardClient({
  analytics,
  preferences,
}: DashboardClientProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={itemVariants}>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your usage and configure your AI agents
            </p>
          </motion.div>

          {/* Stats Overview */}
          <motion.div variants={itemVariants}>
            <StatsOverview summary={analytics.summary} />
          </motion.div>

          {/* Usage Charts */}
          <motion.div variants={itemVariants}>
            <UsageCharts messagesPerDay={analytics.messagesPerDay} />
          </motion.div>

          {/* Two Column Layout for Toggles and Activity */}
          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div variants={itemVariants}>
              <AgentToggles preferences={preferences} />
            </motion.div>

            <motion.div variants={itemVariants}>
              <RecentActivity recentChats={analytics.recentChats} />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
