"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
} from "@/components/ui/glass-card";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import type { AgentPreference } from "@/lib/db/schema";

interface AgentTogglesProps {
  preferences: AgentPreference[];
}

export function AgentToggles({ preferences: initialPreferences }: AgentTogglesProps) {
  const [preferences, setPreferences] = useState<Map<string, boolean>>(() => {
    const map = new Map<string, boolean>();
    // Default all agents to enabled
    for (const agent of agentUserMetadataList) {
      map.set(agent.id, true);
    }
    // Apply saved preferences
    for (const pref of initialPreferences) {
      map.set(pref.agentId, pref.enabled);
    }
    return map;
  });

  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const handleToggle = async (agentId: string, enabled: boolean) => {
    // MainAgent cannot be disabled
    if (agentId === "main-agent") return;

    setIsUpdating(agentId);

    // Optimistic update
    setPreferences((prev) => {
      const newMap = new Map(prev);
      newMap.set(agentId, enabled);
      return newMap;
    });

    try {
      const response = await fetch("/api/user_dashboard/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, enabled }),
      });

      if (!response.ok) {
        // Rollback on error
        setPreferences((prev) => {
          const newMap = new Map(prev);
          newMap.set(agentId, !enabled);
          return newMap;
        });
      }
    } catch {
      // Rollback on error
      setPreferences((prev) => {
        const newMap = new Map(prev);
        newMap.set(agentId, !enabled);
        return newMap;
      });
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <GlassCard intensity="medium">
      <GlassCardHeader>
        <GlassCardTitle>Agent Configuration</GlassCardTitle>
        <GlassCardDescription>
          Enable or disable agents for your conversations
        </GlassCardDescription>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-4">
          {agentUserMetadataList.map((agent) => {
            const isMainAgent = agent.id === "main-agent";
            const isEnabled = preferences.get(agent.id) ?? true;
            const IconComponent = agent.icon || Bot;

            return (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-lg border border-border/50 p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {agent.short_description}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(agent.id, checked)}
                  disabled={isMainAgent || isUpdating === agent.id}
                  aria-label={`Toggle ${agent.name}`}
                />
              </div>
            );
          })}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
