"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SettingsIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { agentUserMetadataList } from "@/lib/agents/user_metadata";
import { AgentConfigModal } from "@/components/settings/agent-config-modal";
import { toast } from "@/components/toast";
import { fetcher } from "@/lib/utils";
import type { AgentPreference } from "@/lib/db/schema";

interface AgentPanelDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModelId: string;
}

interface AgentConfigResponse {
  config: {
    deploymentType: string;
    provider: string | null;
    modelId: string | null;
    hasApiKey: boolean;
    baseUrl: string | null;
  } | null;
}

export function AgentPanelDrawer({
  open,
  onOpenChange,
  selectedModelId,
}: AgentPanelDrawerProps) {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(false);

  // Local state for browsing agents (doesn't affect chat selection)
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset to selected agent when drawer opens
  useEffect(() => {
    if (open) {
      const idx = agentUserMetadataList.findIndex((a) => a.id === selectedModelId);
      setCurrentIndex(idx >= 0 ? idx : 0);
    }
  }, [open, selectedModelId]);

  const agent = agentUserMetadataList[currentIndex];
  const Icon = agent?.icon;
  const isMainAgent = agent?.id === "main-agent";

  // Fetch current config status
  const { data: configData, isLoading: isLoadingConfig } = useSWR<AgentConfigResponse>(
    open && agent ? `/api/user_dashboard/agent-config?agentId=${agent.id}` : null,
    fetcher
  );

  // Fetch agent preferences (enabled/disabled status)
  const { data: preferencesData, mutate: mutatePreferences } = useSWR<{
    preferences: AgentPreference[];
  }>(open ? "/api/user_dashboard/preferences" : null, fetcher);

  const isConfigured = !!configData?.config?.modelId;

  const isAgentEnabled = () => {
    if (!preferencesData?.preferences) return true;
    const pref = preferencesData.preferences.find((p) => p.agentId === agent?.id);
    return pref?.enabled ?? true;
  };

  const handleToggle = async (enabled: boolean) => {
    if (!agent || isMainAgent) return;

    setPendingToggle(true);

    // Optimistic update
    const previousData = preferencesData;
    mutatePreferences(
      {
        preferences:
          preferencesData?.preferences?.map((p) =>
            p.agentId === agent.id ? { ...p, enabled } : p
          ) ?? [],
      },
      false
    );

    try {
      const response = await fetch("/api/user_dashboard/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, enabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to update preference");
      }

      mutatePreferences();
      toast({
        type: "success",
        description: `${agent.name} ${enabled ? "enabled" : "disabled"}`,
      });
    } catch {
      mutatePreferences(previousData, false);
      toast({
        type: "error",
        description: "Failed to update agent preference",
      });
    } finally {
      setPendingToggle(false);
    }
  };

  // Navigate to previous/next agent (just for viewing, doesn't change chat selection)
  const goToPrevAgent = () => {
    setCurrentIndex((prev) =>
      prev <= 0 ? agentUserMetadataList.length - 1 : prev - 1
    );
  };

  const goToNextAgent = () => {
    setCurrentIndex((prev) =>
      prev >= agentUserMetadataList.length - 1 ? 0 : prev + 1
    );
  };

  if (!agent) return null;

  const enabled = isAgentEnabled();

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          {/* Header */}
          <SheetHeader className="text-left">
            <SheetTitle className="sr-only">Agent Settings</SheetTitle>
            <SheetDescription className="sr-only">
              Browse and configure agents
            </SheetDescription>
          </SheetHeader>

          {/* Agent Info */}
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-1 flex-col"
          >
            {/* Navigation + Agent Header */}
            <div className="flex items-center justify-between py-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrevAgent}
                className="size-9"
              >
                <ChevronLeftIcon className="size-5" />
              </Button>

              <div className="flex flex-col items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  {Icon && <Icon className="size-7 text-primary" />}
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">{agent.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {currentIndex + 1} / {agentUserMetadataList.length}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextAgent}
                className="size-9"
              >
                <ChevronRightIcon className="size-5" />
              </Button>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="agent-toggle" className="text-sm font-medium">
                    {enabled ? "Enabled" : "Disabled"}
                  </Label>
                  {isMainAgent && (
                    <Badge variant="secondary" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <Switch
                  id="agent-toggle"
                  checked={enabled}
                  onCheckedChange={handleToggle}
                  disabled={isMainAgent || pendingToggle}
                  className={pendingToggle ? "opacity-50" : ""}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? "Available for direct selection in chat."
                  : "Still accessible via MainAgent orchestration."}
              </p>
            </div>

            {/* Description */}
            <div className="mt-4 rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                {agent.long_description || agent.short_description}
              </p>
            </div>

            {/* Configuration Status */}
            <div className="mt-6 space-y-4">
              <h4 className="text-sm font-medium">Configuration</h4>

              {isLoadingConfig ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading...
                </div>
              ) : isConfigured ? (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-green-500" />
                    <span className="text-sm font-medium">Configured</span>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Deployment</span>
                      <Badge variant="secondary" className="font-normal">
                        {configData?.config?.deploymentType === "self-hosted"
                          ? "Self-Hosted"
                          : "Cloud API"}
                      </Badge>
                    </div>
                    {configData?.config?.provider && (
                      <div className="flex items-center justify-between">
                        <span>Provider</span>
                        <Badge variant="secondary" className="font-normal capitalize">
                          {configData.config.provider}
                        </Badge>
                      </div>
                    )}
                    {configData?.config?.modelId && (
                      <div className="flex items-center justify-between">
                        <span>Model</span>
                        <Badge variant="outline" className="max-w-[180px] truncate font-mono text-xs font-normal">
                          {configData.config.modelId}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-4">
                  <AlertCircle className="size-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Using default configuration
                  </span>
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Settings Button */}
            <Button
              onClick={() => setIsConfigModalOpen(true)}
              className="mt-6 w-full"
              size="lg"
            >
              <SettingsIcon className="mr-2 size-4" />
              Open Settings
            </Button>
          </motion.div>
        </SheetContent>
      </Sheet>

      {/* Agent Config Modal */}
      <AgentConfigModal
        agent={agent}
        open={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        hideOverlay
      />
    </>
  );
}
