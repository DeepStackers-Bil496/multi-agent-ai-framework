"use client";

import Link from "next/link";
import { MessageSquare, Clock } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
} from "@/components/ui/glass-card";

interface RecentChat {
  id: string;
  title: string;
  createdAt: string;
}

interface RecentActivityProps {
  recentChats: RecentChat[];
}

export function RecentActivity({ recentChats }: RecentActivityProps) {
  return (
    <GlassCard intensity="medium">
      <GlassCardHeader>
        <GlassCardTitle>Recent Activity</GlassCardTitle>
        <GlassCardDescription>Your recent conversations</GlassCardDescription>
      </GlassCardHeader>
      <GlassCardContent>
        {recentChats.length > 0 ? (
          <div className="space-y-3">
            {recentChats.map((chat) => (
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
            <p className="text-sm">Start a new chat to see activity here</p>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
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
