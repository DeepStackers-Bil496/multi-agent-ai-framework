"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  MessageSquare,
  MessagesSquare,
  Zap,
  Clock,
  TrendingUp
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
} from "@/components/ui/glass-card";
import { fetcher } from "@/lib/utils";

interface DashboardAnalytics {
  summary: {
    totalChats: number;
    totalMessages: number;
    totalTokens: number;
  };
  recentChats: Array<{
    id: string;
    title: string;
    createdAt: string;
  }>;
  messagesPerDay: Array<{
    date: string;
    count: number;
  }>;
}

export function UsageTab() {
  const { data, isLoading } = useSWR<DashboardAnalytics>(
    "/api/user_dashboard/analytics",
    fetcher
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-[300px] w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usage</h2>
        <p className="text-muted-foreground">
          Track your platform usage and conversation statistics
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard intensity="medium">
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">
              Total Chats
            </GlassCardTitle>
            <div className="rounded-lg p-2 bg-blue-500/10">
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{data.summary.totalChats}</div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard intensity="medium">
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">
              Total Messages
            </GlassCardTitle>
            <div className="rounded-lg p-2 bg-green-500/10">
              <MessagesSquare className="h-4 w-4 text-green-500" />
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{data.summary.totalMessages}</div>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Usage Charts */}
      <UsageChartsSection messagesPerDay={data.messagesPerDay} />

      {/* Recent Activity */}
      <RecentActivitySection recentChats={data.recentChats} />
    </div>
  );
}

function UsageChartsSection({ messagesPerDay }: { messagesPerDay: Array<{ date: string; count: number }> }) {
  const chartData = messagesPerDay.map((item) => ({
    date: formatDate(item.date),
    messages: item.count,
  }));

  const filledData = fillMissingDates(chartData);

  return (
    <GlassCard intensity="medium">
      <GlassCardHeader>
        <GlassCardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Messages Over Time
        </GlassCardTitle>
        <GlassCardDescription>
          Your message activity over the last 30 days
        </GlassCardDescription>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="h-[300px] w-full">
          {filledData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filledData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted/30"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMessages)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No activity data available
            </div>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

function RecentActivitySection({ recentChats }: { recentChats: Array<{ id: string; title: string; createdAt: string }> }) {
  return (
    <GlassCard intensity="medium">
      <GlassCardHeader>
        <GlassCardTitle className="text-lg">Recent Activity</GlassCardTitle>
        <GlassCardDescription>Your last conversation history</GlassCardDescription>
      </GlassCardHeader>
      <GlassCardContent>
        {recentChats.length > 0 ? (
          <div className="space-y-3">
            {recentChats.slice(0, 5).map((chat) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="truncate font-medium">{chat.title}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(chat.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <MessageSquare className="mb-2 h-8 w-8 opacity-50" />
            <p>No recent conversations</p>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}

// Helper functions
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fillMissingDates(
  data: { date: string; messages: number }[]
): { date: string; messages: number }[] {
  if (data.length === 0) return [];

  const result: { date: string; messages: number }[] = [];
  const dataMap = new Map(data.map((d) => [d.date, d.messages]));

  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const formattedDate = formatDate(date.toISOString().split("T")[0]);
    result.push({
      date: formattedDate,
      messages: dataMap.get(formattedDate) || 0,
    });
  }

  return result;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
