"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { fetcher } from "@/lib/utils";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import { toast } from "@/components/toast";
import type { AgentPreference } from "@/lib/db/schema";

export function CapabilitiesTab() {
  const { data: preferencesData, mutate } = useSWR<{
    preferences: AgentPreference[];
  }>("/api/user_dashboard/preferences", fetcher);

  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);

  const isAgentEnabled = (agentId: string) => {
    if (!preferencesData?.preferences) return true;
    const pref = preferencesData.preferences.find((p) => p.agentId === agentId);
    return pref?.enabled ?? true;
  };

  const handleToggle = async (agentId: string, enabled: boolean) => {
    // MainAgent cannot be disabled
    if (agentId === "main-agent") {
      toast({
        type: "error",
        description: "MainAgent cannot be disabled",
      });
      return;
    }

    setPendingAgentId(agentId);

    // Optimistic update
    const previousData = preferencesData;
    mutate(
      {
        preferences:
          preferencesData?.preferences?.map((p) =>
            p.agentId === agentId ? { ...p, enabled } : p
          ) ?? [],
      },
      false
    );

    try {
      const response = await fetch("/api/user_dashboard/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, enabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to update preference");
      }

      mutate();
    } catch {
      // Rollback on error
      mutate(previousData, false);
      toast({
        type: "error",
        description: "Failed to update agent preference",
      });
    } finally {
      setPendingAgentId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Capabilities</h2>
        <p className="text-muted-foreground">
          Configure which AI agents are available for your chats
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Agents</CardTitle>
          <CardDescription>
            Enable or disable specific AI agents based on your needs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {agentUserMetadataList.map((agent) => {
            const Icon = agent.icon;
            const isMainAgent = agent.id === "main-agent";
            const enabled = isAgentEnabled(agent.id);
            const isPending = pendingAgentId === agent.id;

            return (
              <div
                key={agent.id}
                className="flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                    {Icon && <Icon className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">{agent.name}</Label>
                      {isMainAgent && (
                        <Badge variant="secondary" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {agent.short_description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => handleToggle(agent.id, checked)}
                  disabled={isMainAgent || isPending}
                  className={isPending ? "opacity-50" : ""}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent Information</CardTitle>
          <CardDescription>
            Learn more about how agents work together
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <p>
              <strong>MainAgent</strong> is the primary orchestrator that routes
              your requests to specialized agents based on intent.
            </p>
            <p>
              Disabling an agent will prevent MainAgent from delegating tasks to
              it. The MainAgent will handle those requests directly or suggest
              alternatives.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
