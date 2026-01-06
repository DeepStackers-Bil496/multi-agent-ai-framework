"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { MessageSquare, Bot, RefreshCw } from "lucide-react";
import { AgentCards } from "./agent-cards";
import { PerformanceMetrics } from "./performance-metrics";
import { EventMonitor } from "./event-monitor";
import { RecentExecutions } from "./recent-executions";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import { fetcher } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardMetrics {
  summary: {
    totalAgentCalls: number;
    totalToolCalls: number;
    totalErrors: number;
    avgLatencyMs: number;
    activeAgents: number;
  };
  agentMetrics: Array<{
    agentId: string;
    agentName: string;
    totalCalls: number;
    totalToolCalls: number;
    avgLatencyMs: number;
    errorCount: number;
    lastUsed: string | null;
  }>;
  recentEvents: Array<{
    id: string;
    type: "agent" | "tool";
    name: string;
    status: "running" | "completed" | "error";
    timestamp: number;
    duration: number;
    chatId: string;
  }>;
  recentExecutions: Array<{
    chatId: string;
    steps: any[];
    createdAt: string;
  }>;
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

export function AgentsDashboardClient() {
  const router = useRouter();

  const { data: metrics, isLoading, mutate } = useSWR<DashboardMetrics>(
    "/api/agents_dashboard/metrics",
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  const defaultSummary = {
    totalAgentCalls: 0,
    totalToolCalls: 0,
    totalErrors: 0,
    avgLatencyMs: 0,
    activeAgents: 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-8"
        >
          {/* Header */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Agents Dashboard</h1>
              </div>
              <p className="mt-2 text-muted-foreground">
                Monitor agent performance, events, and execution flows
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => mutate()}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Back to Chat
              </Button>
            </div>
          </motion.div>

          {/* Performance Metrics */}
          <motion.div variants={itemVariants}>
            <PerformanceMetrics
              summary={metrics?.summary || defaultSummary}
              isLoading={isLoading}
            />
          </motion.div>

          {/* Tabs for different views */}
          <motion.div variants={itemVariants}>
            <Tabs defaultValue="agents" className="w-full">
              <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                <TabsTrigger value="agents">Agents</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="flows">Flows</TabsTrigger>
              </TabsList>

              <TabsContent value="agents" className="mt-6">
                <AgentCards agents={agentUserMetadataList} />
              </TabsContent>

              <TabsContent value="events" className="mt-6">
                <EventMonitor
                  events={metrics?.recentEvents || []}
                  isLoading={isLoading}
                />
              </TabsContent>

              <TabsContent value="flows" className="mt-6">
                <RecentExecutions
                  executions={metrics?.recentExecutions || []}
                  isLoading={isLoading}
                />
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
