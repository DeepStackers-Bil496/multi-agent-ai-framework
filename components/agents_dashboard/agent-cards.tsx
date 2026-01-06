"use client";

import { Bot, Sparkles } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
} from "@/components/ui/glass-card";
import type { AgentUserMetadata } from "@/lib/types";

interface AgentCardsProps {
  agents: AgentUserMetadata[];
}

export function AgentCards({ agents }: AgentCardsProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => {
        const IconComponent = agent.icon || Bot;
        const isMainAgent = agent.id === "main-agent";

        return (
          <GlassCard key={agent.id} intensity="medium" className="relative overflow-hidden">
            {isMainAgent && (
              <div className="absolute right-3 top-3">
                <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                  <Sparkles className="h-3 w-3" />
                  Orchestrator
                </div>
              </div>
            )}
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <IconComponent className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <GlassCardTitle className="text-lg">{agent.name}</GlassCardTitle>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ID: {agent.id}
                  </div>
                </div>
              </div>
            </GlassCardHeader>
            <GlassCardContent>
              <GlassCardDescription className="mb-4">
                {agent.short_description}
              </GlassCardDescription>

              {agent.long_description && (
                <p className="mb-4 text-sm text-muted-foreground/80">
                  {agent.long_description}
                </p>
              )}

              {agent.suggestedActions && agent.suggestedActions.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Example Actions
                  </div>
                  <div className="space-y-2">
                    {agent.suggestedActions.slice(0, 2).map((action, index) => (
                      <div
                        key={index}
                        className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                      >
                        {action.length > 80 ? `${action.slice(0, 80)}...` : action}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        );
      })}
    </div>
  );
}
