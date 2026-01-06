"use client";

import { Bot, Wrench, AlertCircle, Clock, Activity } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
} from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

interface PerformanceMetricsProps {
  summary: {
    totalAgentCalls: number;
    totalToolCalls: number;
    totalErrors: number;
    avgLatencyMs: number;
    activeAgents: number;
  };
  isLoading?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  isLoading?: boolean;
}

function MetricCard({ title, value, subtitle, icon, color, isLoading }: MetricCardProps) {
  return (
    <GlassCard intensity="medium" className="relative overflow-hidden">
      <GlassCardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </span>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted/50 rounded animate-pulse" />
            ) : (
              <span className="text-2xl font-bold">{value}</span>
            )}
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", color)}>
            {icon}
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

export function PerformanceMetrics({ summary, isLoading }: PerformanceMetricsProps) {
  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      <MetricCard
        title="Agent Calls"
        value={summary.totalAgentCalls}
        subtitle="Last 7 days"
        icon={<Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
        color="bg-blue-500/10"
        isLoading={isLoading}
      />
      <MetricCard
        title="Tool Calls"
        value={summary.totalToolCalls}
        subtitle="Total invocations"
        icon={<Wrench className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
        color="bg-purple-500/10"
        isLoading={isLoading}
      />
      <MetricCard
        title="Avg Latency"
        value={formatLatency(summary.avgLatencyMs)}
        subtitle="Per agent call"
        icon={<Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
        color="bg-amber-500/10"
        isLoading={isLoading}
      />
      <MetricCard
        title="Errors"
        value={summary.totalErrors}
        subtitle="Failed executions"
        icon={<AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
        color="bg-red-500/10"
        isLoading={isLoading}
      />
      <MetricCard
        title="Active Agents"
        value={summary.activeAgents}
        subtitle="Used recently"
        icon={<Activity className="h-5 w-5 text-green-600 dark:text-green-400" />}
        color="bg-green-500/10"
        isLoading={isLoading}
      />
    </div>
  );
}
