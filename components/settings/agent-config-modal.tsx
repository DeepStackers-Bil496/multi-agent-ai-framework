"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/toast";
import { fetcher } from "@/lib/utils";
import type { AgentUserMetadata, LLMProvider } from "@/lib/types";
import { Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

interface AgentConfigModalProps {
  agent: AgentUserMetadata;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AgentConfigResponse {
  config: {
    deploymentType: string;
    provider: string | null;
    modelId: string | null;
    hasApiKey: boolean;
    baseUrl: string | null;
    hasAgentSecrets: boolean;
    configuredSecrets: string[];
  } | null;
}

// Agent-specific secret fields configuration
const AGENT_SECRET_FIELDS: Record<
  string,
  { key: string; label: string; placeholder: string }[]
> = {
  "github-agent": [
    {
      key: "GITHUB_PAT",
      label: "GitHub Personal Access Token",
      placeholder: "ghp_xxxxxxxxxxxx",
    },
  ],
  "huggingface-agent": [
    {
      key: "HF_TOKEN",
      label: "HuggingFace Access Token",
      placeholder: "hf_xxxxxxxxxxxx",
    },
  ],
  "google-workspace-agent": [
    {
      key: "GOOGLE_OAUTH_TOKEN",
      label: "Google OAuth Token",
      placeholder: "ya29.xxxxxxxxxxxx",
    },
  ],
};

const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "groq", label: "Groq" },
  { value: "mistral", label: "Mistral AI" }
];

export function AgentConfigModal({
  agent,
  open,
  onOpenChange,
}: AgentConfigModalProps) {
  const [deploymentType, setDeploymentType] = useState<"cloud" | "self-hosted">(
    "cloud"
  );
  const [provider, setProvider] = useState<LLMProvider>("google");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [agentSecrets, setAgentSecrets] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data, mutate } = useSWR<AgentConfigResponse>(
    open ? `/api/user_dashboard/agent-config?agentId=${agent.id}` : null,
    fetcher
  );

  // Populate form with existing config
  useEffect(() => {
    if (data?.config) {
      setDeploymentType(
        (data.config.deploymentType as "cloud" | "self-hosted") || "cloud"
      );
      setProvider((data.config.provider as LLMProvider) || "google");
      setModelId(data.config.modelId || "");
      setBaseUrl(data.config.baseUrl || "");
      // Don't populate secrets - user must re-enter for security
      setApiKey("");
      setAgentSecrets({});
    } else {
      // Reset form when no config exists
      setDeploymentType("cloud");
      setProvider("google");
      setModelId("");
      setBaseUrl("");
      setApiKey("");
      setAgentSecrets({});
    }
  }, [data]);

  const secretFields = AGENT_SECRET_FIELDS[agent.id] || [];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        agentId: agent.id,
        deploymentType,
      };

      if (deploymentType === "cloud") {
        payload.provider = provider;
        payload.modelId = modelId || undefined;
        if (apiKey.trim()) payload.apiKey = apiKey.trim();
      } else {
        payload.baseUrl = baseUrl || undefined;
        payload.modelId = modelId || undefined;
      }

      // Only include secrets that have values
      const filteredSecrets = Object.fromEntries(
        Object.entries(agentSecrets).filter(
          ([, v]) => typeof v === "string" && v.trim()
        )
      );
      if (Object.keys(filteredSecrets).length > 0) {
        payload.agentSecrets = filteredSecrets;
      }

      const response = await fetch("/api/user_dashboard/agent-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save configuration");
      }

      mutate();
      toast({ type: "success", description: "Configuration saved successfully" });
      onOpenChange(false);
    } catch (error) {
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to save configuration",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/user_dashboard/agent-config?agentId=${agent.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to reset");

      mutate();
      setDeploymentType("cloud");
      setProvider("google");
      setModelId("");
      setApiKey("");
      setBaseUrl("");
      setAgentSecrets({});
      toast({ type: "success", description: "Configuration reset to defaults" });
    } catch {
      toast({ type: "error", description: "Failed to reset configuration" });
    } finally {
      setIsSaving(false);
    }
  };

  const Icon = agent.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="rounded-lg bg-primary/10 p-2">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <DialogTitle>Configure {agent.name}</DialogTitle>
              <DialogDescription>
                Customize the model and credentials for this agent
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Agent-specific secrets section */}
          {secretFields.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Authentication</h4>
              {secretFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <div className="relative">
                    <Input
                      id={field.key}
                      type={showSecrets[field.key] ? "text" : "password"}
                      placeholder={field.placeholder}
                      value={agentSecrets[field.key] || ""}
                      onChange={(e) =>
                        setAgentSecrets((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setShowSecrets((prev) => ({
                          ...prev,
                          [field.key]: !prev[field.key],
                        }))
                      }
                    >
                      {showSecrets[field.key] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {data?.config?.configuredSecrets?.includes(field.key) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Already configured. Enter a new value to update.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Model Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Model Configuration</h4>

            {/* Deployment Type */}
            <div className="space-y-2">
              <Label>Deployment Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deploymentType"
                    checked={deploymentType === "cloud"}
                    onChange={() => setDeploymentType("cloud")}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Cloud API</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deploymentType"
                    checked={deploymentType === "self-hosted"}
                    onChange={() => setDeploymentType("self-hosted")}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Self-Hosted</span>
                </label>
              </div>
            </div>

            {deploymentType === "cloud" ? (
              <>
                {/* Provider Selection */}
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={provider}
                    onValueChange={(v) => setProvider(v as LLMProvider)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder="Enter your API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {data?.config?.hasApiKey && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Already configured. Enter a new value to update.
                    </p>
                  )}
                </div>

                {/* Model ID */}
                <div className="space-y-2">
                  <Label htmlFor="modelId">Model ID</Label>
                  <Input
                    id="modelId"
                    placeholder="e.g., gemini-2.5-flash, gpt-4o"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use the default model for this provider
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Self-hosted URL */}
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Deployment URL</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://your-server.ngrok.app"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL of your Ollama, vLLM or local server
                  </p>
                </div>

                {/* Model ID for self-hosted */}
                <div className="space-y-2">
                  <Label htmlFor="modelId">Model ID</Label>
                  <Input
                    id="modelId"
                    placeholder="e.g., llama3.2, mistral"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving || !data?.config}
          >
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
