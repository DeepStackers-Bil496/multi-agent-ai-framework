"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/utils";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import { toast } from "@/components/toast";
import type { AgentPreference } from "@/lib/db/schema";
import type { AgentUserMetadata } from "@/lib/types";
import { Settings } from "lucide-react";
import { AgentConfigModal } from "../agent-config-modal";

export function CapabilitiesTab() {
  const { data: preferencesData, mutate } = useSWR<{
    preferences: AgentPreference[];
  }>("/api/user_dashboard/preferences", fetcher);

  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [configModalAgent, setConfigModalAgent] = useState<AgentUserMetadata | null>(null);

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
            Enable agents for standalone usage. Enabled agents can be selected directly from the chat page.
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setConfigModalAgent(agent)}
                    title="Configure agent"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => handleToggle(agent.id, checked)}
                    disabled={isMainAgent || isPending}
                    className={isPending ? "opacity-50" : ""}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Agent Configuration Modal */}
      {configModalAgent && (
        <AgentConfigModal
          agent={configModalAgent}
          open={!!configModalAgent}
          onOpenChange={(open) => !open && setConfigModalAgent(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>How Agents Work</CardTitle>
          <CardDescription>
            Understanding standalone usage vs orchestration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4 text-sm space-y-3">
            <div>
              <strong className="text-foreground">🎯 Standalone Mode (Enabled)</strong>
              <p className="mt-1 text-muted-foreground">
                When you enable an agent, it becomes available for direct selection from the chat page.
                You can choose it as your primary agent and interact with it directly for specialized tasks.
              </p>
            </div>
            <div>
              <strong className="text-foreground">🔄 Orchestration Mode</strong>
              <p className="mt-1 text-muted-foreground">
                All agents (enabled or disabled) are always available to the <strong>MainAgent</strong> orchestrator.
                When you chat with MainAgent, it automatically delegates tasks to the most suitable specialized agent based on your request.
              </p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-muted-foreground">
                <strong className="text-foreground">💡 Tip:</strong> Enable agents you want to use directly.
                Leave them disabled if you prefer MainAgent to handle orchestration automatically.
              </p>
              <p className="mt-2 text-muted-foreground">
                <strong className="text-foreground">⚙️ Important:</strong> Configure API keys and tokens for each agent regardless of its toggle state,
                as MainAgent may delegate tasks to any configured agent during orchestration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
