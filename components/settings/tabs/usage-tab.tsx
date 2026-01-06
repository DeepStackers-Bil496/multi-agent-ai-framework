"use client";

import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/utils";
import { MessageSquare, Hash, Zap, TrendingUp } from "lucide-react";

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

  const stats = [
    {
      title: "Total Chats",
      value: data?.summary.totalChats ?? 0,
      icon: MessageSquare,
      description: "Conversations started",
    },
    {
      title: "Total Messages",
      value: data?.summary.totalMessages ?? 0,
      icon: Hash,
      description: "Messages exchanged",
    },
    {
      title: "Tokens Used",
      value: data?.summary.totalTokens ?? 0,
      icon: Zap,
      description: "AI processing tokens",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Usage</h2>
        <p className="text-muted-foreground">
          Track your platform usage and statistics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stat.value.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Your recent conversations (last 30 days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.recentChats && data.recentChats.length > 0 ? (
            <div className="space-y-3">
              {data.recentChats.slice(0, 5).map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="truncate">
                    <p className="font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(chat.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recent activity to display
            </p>
          )}
        </CardContent>
      </Card>

      {/* Usage Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Over Time</CardTitle>
          <CardDescription>
            Messages sent per day (last 30 days)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.messagesPerDay && data.messagesPerDay.length > 0 ? (
            <div className="h-[200px] flex items-end gap-1">
              {data.messagesPerDay.slice(-30).map((day, index) => {
                const maxCount = Math.max(
                  ...data.messagesPerDay.map((d) => d.count)
                );
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div
                    key={index}
                    className="flex-1 bg-primary/80 rounded-t transition-all hover:bg-primary"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${day.date}: ${day.count} messages`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No usage data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
