"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, ExternalLink, ChevronDown, Bot, Wrench, ArrowRight } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
} from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ExecutionFlowGraph, ExecutionFlowGraphCompact } from "./execution-flow-graph";
import type { ExecutionStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RecentExecution {
  chatId: string;
  steps: ExecutionStep[];
  createdAt: string;
}

interface RecentExecutionsProps {
  executions: RecentExecution[];
  isLoading?: boolean;
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getTotalDuration(steps: ExecutionStep[]): number {
  let minStart = Infinity;
  let maxEnd = 0;

  const traverse = (step: ExecutionStep) => {
    if (step.startTime < minStart) minStart = step.startTime;
    if (step.endTime && step.endTime > maxEnd) maxEnd = step.endTime;
    step.children?.forEach(traverse);
  };

  steps.forEach(traverse);

  if (minStart === Infinity || maxEnd === 0) return 0;
  return maxEnd - minStart;
}

function countSteps(steps: ExecutionStep[]): { agents: number; tools: number } {
  let agents = 0;
  let tools = 0;

  const traverse = (step: ExecutionStep) => {
    if (step.type === "agent") agents++;
    if (step.type === "tool") tools++;
    step.children?.forEach(traverse);
  };

  steps.forEach(traverse);
  return { agents, tools };
}

function ExecutionItem({ execution, index }: { execution: RecentExecution; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const duration = getTotalDuration(execution.steps);
  const { agents, tools } = countSteps(execution.steps);
  const rootAgent = execution.steps[0]?.name || "Unknown Agent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="border border-border/50 rounded-lg overflow-hidden bg-card/30"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex flex-col gap-2 p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{rootAgent}</span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3" />
                {agents} agents
              </span>
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                {tools} tools
              </span>
              <span>{(duration / 1000).toFixed(1)}s</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(execution.createdAt)}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </div>

        {/* Compact flow preview */}
        <div className="w-full overflow-hidden">
          <ExecutionFlowGraphCompact steps={execution.steps} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-dashed border-border/50">
              <div className="pt-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Execution Flow
                </div>
                <div className="bg-muted/20 rounded-lg border border-border/30">
                  <ExecutionFlowGraph steps={execution.steps} />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Link href={`/chat/${execution.chatId}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    View Chat
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function RecentExecutions({ executions, isLoading }: RecentExecutionsProps) {
  if (isLoading) {
    return (
      <GlassCard intensity="medium">
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <GlassCardTitle>Execution Flows</GlassCardTitle>
          </div>
          <GlassCardDescription>Visual delegation paths</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
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
          <GitBranch className="h-5 w-5 text-primary" />
          <GlassCardTitle>Execution Flows</GlassCardTitle>
        </div>
        <GlassCardDescription>
          Visual representation of agent delegation paths with arrows
        </GlassCardDescription>
      </GlassCardHeader>
      <GlassCardContent>
        {executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No execution flows yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Agent delegation paths will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {executions.map((execution, index) => (
              <ExecutionItem
                key={`${execution.chatId}-${index}`}
                execution={execution}
                index={index}
              />
            ))}
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
