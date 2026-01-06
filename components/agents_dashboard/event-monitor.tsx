"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
} from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
} from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExecutionEvent {
  id: string;
  type: "agent" | "tool";
  name: string;
  status: "running" | "completed" | "error";
  timestamp: number;
  duration: number;
  chatId: string;
}

interface EventMonitorProps {
  events: ExecutionEvent[];
  isLoading?: boolean;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function EventItem({ event, index }: { event: ExecutionEvent; index: number }) {
  const [timeAgo, setTimeAgo] = useState(formatTimeAgo(event.timestamp));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(event.timestamp));
    }, 10000);
    return () => clearInterval(interval);
  }, [event.timestamp]);

  const statusConfig = {
    running: {
      icon: <Clock className="h-3.5 w-3.5 text-blue-500" />,
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
    },
    completed: {
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
      bg: "bg-green-500/10",
      text: "text-green-600 dark:text-green-400",
    },
    error: {
      icon: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
      bg: "bg-red-500/10",
      text: "text-red-600 dark:text-red-400",
    },
  };

  const config = statusConfig[event.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors",
        config.bg
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background/50">
          {event.type === "agent" ? (
            <Bot className="h-4 w-4 text-primary" />
          ) : (
            <Wrench className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{event.name}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded", config.bg, config.text)}>
              {event.status}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {event.type === "agent" ? "Agent" : "Tool"} • {formatDuration(event.duration)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {config.icon}
        <span className="text-xs text-muted-foreground">{timeAgo}</span>
      </div>
    </motion.div>
  );
}

export function EventMonitor({ events, isLoading }: EventMonitorProps) {
  if (isLoading) {
    return (
      <GlassCard intensity="medium">
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <GlassCardTitle>Event Monitor</GlassCardTitle>
          </div>
          <GlassCardDescription>Real-time agent and tool events</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard intensity="medium">
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <GlassCardTitle>Event Monitor</GlassCardTitle>
        </div>
        <GlassCardDescription>
          Recent agent and tool events ({events.length} events)
        </GlassCardDescription>
      </GlassCardHeader>
      <GlassCardContent>
        <ScrollArea className="h-[400px] pr-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">No events recorded yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start a chat to see agent activity
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {events.map((event, index) => (
                  <EventItem key={event.id} event={event} index={index} />
                ))}
              </div>
            </AnimatePresence>
          )}
        </ScrollArea>
      </GlassCardContent>
    </GlassCard>
  );
}
