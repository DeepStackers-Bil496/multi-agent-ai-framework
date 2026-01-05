"use client";

import { MessageSquare, MessagesSquare, Coins } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";

interface StatsSummary {
  totalChats: number;
  totalMessages: number;
  totalTokens: number;
}

interface StatsOverviewProps {
  summary: StatsSummary;
}

export function StatsOverview({ summary }: StatsOverviewProps) {
  const stats = [
    {
      title: "Total Chats",
      value: summary.totalChats,
      icon: MessageSquare,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total Messages",
      value: summary.totalMessages,
      icon: MessagesSquare,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Tokens Used",
      value: formatNumber(summary.totalTokens),
      icon: Coins,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <GlassCard key={stat.title} intensity="medium">
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </GlassCardTitle>
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </GlassCardContent>
        </GlassCard>
      ))}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}
