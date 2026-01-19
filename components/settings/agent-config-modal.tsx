"use client";

import { useState, useEffect, useCallback } from "react";
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
  hideOverlay?: boolean;
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

interface ModelInfo {
  id: string;
  name: string;
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
      key: "GOOGLE_CLIENT_ID",
      label: "Google OAuth Client ID",
      placeholder: "xxxxxxxxxxxx.apps.googleusercontent.com",
    },
    {
      key: "GOOGLE_CLIENT_SECRET",
      label: "Google OAuth Client Secret",
      placeholder: "GOCSPX-xxxxxxxxxxxx",
    },
    {
      key: "GOOGLE_REFRESH_TOKEN",
      label: "Google OAuth Refresh Token",
      placeholder: "1//xxxxxxxxxxxx",
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

const SELF_HOSTED_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "ollama", label: "Ollama" }
];

export function AgentConfigModal({
  agent,
  open,
  onOpenChange,
  hideOverlay,
}: AgentConfigModalProps) {
  const [deploymentType, setDeploymentType] = useState<"cloud" | "self-hosted">(
    "cloud"
  );
  const [provider, setProvider] = useState<LLMProvider>("google");
  const [selfHostedProvider, setSelfHostedProvider] = useState<LLMProvider>("ollama");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [agentSecrets, setAgentSecrets] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Model fetching state
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const { data, isLoading: isLoadingConfig, mutate } = useSWR<AgentConfigResponse>(
    open ? `/api/user_dashboard/agent-config?agentId=${agent.id}` : null,
    fetcher
  );

  // Populate form with existing config
  useEffect(() => {
    if (data?.config) {
      const storedDeploymentType = (data.config.deploymentType as "cloud" | "self-hosted") || "cloud";
      setDeploymentType(storedDeploymentType);

      // Set provider based on deployment type
      if (storedDeploymentType === "self-hosted") {
        setSelfHostedProvider((data.config.provider as LLMProvider) || "ollama");
      } else {
        setProvider((data.config.provider as LLMProvider) || "google");
      }

      setModelId(data.config.modelId || "");
      setBaseUrl(data.config.baseUrl || "");
      // Don't populate secrets - user must re-enter for security
      setApiKey("");
      setAgentSecrets({});
    } else {
      // Reset form when no config exists
      setDeploymentType("cloud");
      setProvider("google");
      setSelfHostedProvider("ollama");
      setModelId("");
      setBaseUrl("");
      setApiKey("");
      setAgentSecrets({});
    }
  }, [data]);

  // Fetch models from API
  const fetchModels = useCallback(async () => {
    setModelsError(null);
    setModels([]);

    // For cloud: use either new API key or stored API key (via agentId)
    if (deploymentType === "cloud") {
      const hasNewApiKey = apiKey.trim().length > 0;
      const hasStoredApiKey = data?.config?.hasApiKey;

      if (!hasNewApiKey && !hasStoredApiKey) {
        setModelsError("Please enter an API key first");
        return;
      }

      setIsLoadingModels(true);
      try {
        const params = new URLSearchParams({ provider });

        // If user entered a new API key, use it; otherwise use stored key via agentId
        if (hasNewApiKey) {
          params.set("apiKey", apiKey.trim());
        } else {
          params.set("agentId", agent.id);
        }

        const response = await fetch(`/api/models/list?${params}`);
        const responseData = await response.json();

        if (!response.ok) {
          // Provide clearer error message for API key issues
          const providerName = LLM_PROVIDERS.find(p => p.value === provider)?.label || provider;
          throw new Error(`Invalid API key for ${providerName}. Please check your API key.`);
        }

        setModels(responseData.models || []);
      } catch (error) {
        setModelsError(
          error instanceof Error ? error.message : "Failed to fetch models"
        );
      } finally {
        setIsLoadingModels(false);
      }
    } else {
      // Self-hosted: require base URL (use entered or stored)
      const hasNewBaseUrl = baseUrl.trim().length > 0;
      const hasStoredBaseUrl = !!data?.config?.baseUrl;

      if (!hasNewBaseUrl && !hasStoredBaseUrl) {
        setModelsError("Please enter a deployment URL first");
        return;
      }

      setIsLoadingModels(true);
      try {
        const params = new URLSearchParams({ provider: selfHostedProvider });

        // If user entered a new baseUrl, use it; otherwise use stored key via agentId
        if (hasNewBaseUrl) {
          params.set("baseUrl", baseUrl.trim());
        } else {
          params.set("agentId", agent.id);
        }

        const response = await fetch(`/api/models/list?${params}`);
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error("Could not connect to server. Please check the URL.");
        }

        setModels(responseData.models || []);
      } catch (error) {
        setModelsError(
          error instanceof Error ? error.message : "Failed to fetch models"
        );
      } finally {
        setIsLoadingModels(false);
      }
    }
  }, [deploymentType, provider, selfHostedProvider, apiKey, baseUrl, agent.id, data?.config]);

  // Auto-fetch models when:
  // 1. Modal opens and there's a stored API key
  // 2. Provider changes (cloud mode)
  // 3. API key changes (cloud mode) - with debounce
  // 4. Base URL changes (self-hosted mode) - with debounce
  useEffect(() => {
    // Reset models when deployment type or provider changes
    setModels([]);
    setModelsError(null);

    const storedDeploymentType = data?.config?.deploymentType;
    const storedModelId = data?.config?.modelId;

    // If switching back to stored deployment type, restore the stored modelId
    if (storedDeploymentType && deploymentType === storedDeploymentType) {
      setModelId(storedModelId || "");
    }
    // If switching away from stored deployment type, reset modelId
    else if (storedDeploymentType && deploymentType !== storedDeploymentType) {
      setModelId("");
    }

    // Only reset modelId if user changed to a different provider than what's stored (cloud mode)
    const storedProvider = data?.config?.provider;
    if (deploymentType === "cloud" && storedProvider && provider !== storedProvider) {
      setModelId("");
    }

    // For cloud: auto-fetch if there's a stored API key
    if (deploymentType === "cloud" && data?.config?.hasApiKey && !apiKey.trim()) {
      fetchModels();
    }
  }, [deploymentType, provider, data?.config?.provider, data?.config?.hasApiKey, data?.config?.deploymentType, data?.config?.modelId]);

  // Debounced auto-fetch when API key is entered (cloud mode)
  useEffect(() => {
    if (deploymentType !== "cloud" || !apiKey.trim()) return;

    const timer = setTimeout(() => {
      fetchModels();
    }, 500);

    return () => clearTimeout(timer);
  }, [apiKey, fetchModels, deploymentType]);

  // Debounced auto-fetch when base URL is entered (self-hosted mode)
  useEffect(() => {
    if (deploymentType !== "self-hosted") return;

    // Auto-fetch if there's a stored baseUrl
    if (data?.config?.baseUrl && !baseUrl.trim()) {
      fetchModels();
      return;
    }

    if (!baseUrl.trim()) return;

    // Reset modelId and models when URL changes (different servers have different models)
    const storedBaseUrl = data?.config?.baseUrl;
    if (baseUrl.trim() !== storedBaseUrl) {
      setModelId("");
      setModels([]);
    }

    const timer = setTimeout(() => {
      fetchModels();
    }, 500);

    return () => clearTimeout(timer);
  }, [baseUrl, fetchModels, deploymentType, data?.config?.baseUrl]);

  const secretFields = AGENT_SECRET_FIELDS[agent.id] || [];

  const handleSave = async () => {
    // Validation: Check if model is selected
    if (!modelId) {
      toast({
        type: "error",
        description: "Please select a model before saving",
      });
      return;
    }

    // Validation: Check if API key is valid (for cloud mode)
    if (deploymentType === "cloud" && modelsError) {
      toast({
        type: "error",
        description: "Please enter a valid API key before saving",
      });
      return;
    }

    // Validation: Check if base URL is provided and valid (for self-hosted mode)
    if (deploymentType === "self-hosted" && (!baseUrl.trim() || modelsError)) {
      toast({
        type: "error",
        description: "Please enter a valid deployment URL before saving",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        agentId: agent.id,
        deploymentType,
      };

      if (deploymentType === "cloud") {
        payload.provider = provider;
        payload.modelId = modelId;
        if (apiKey.trim()) payload.apiKey = apiKey.trim();
      } else {
        payload.provider = selfHostedProvider;
        payload.baseUrl = baseUrl || undefined;
        payload.modelId = modelId;
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
      setSelfHostedProvider("ollama");
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
      <DialogContent className="max-w-lg h-[600px] overflow-y-auto" hideOverlay={hideOverlay}>
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
          {isLoadingConfig ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (<>
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
                  {data?.config?.hasApiKey && !modelsError && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Already configured. Enter a new value to update.
                    </p>
                  )}
                  {data?.config?.hasApiKey && modelsError && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      Stored API key may not be valid for this provider.
                    </p>
                  )}
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <Label htmlFor="modelId">Model</Label>
                  <Select
                    value={modelId}
                    onValueChange={setModelId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Show saved modelId first if not in loaded models */}
                      {modelId && !models.find(m => m.id === modelId) && (
                        <SelectItem key={modelId} value={modelId}>
                          {modelId}
                        </SelectItem>
                      )}
                      {isLoadingModels && models.length === 0 && (
                        <SelectItem value="_loading" disabled>
                          Loading models...
                        </SelectItem>
                      )}
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {modelsError && (
                    <p className="text-xs text-destructive">{modelsError}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Provider Selection for Self-hosted */}
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select
                    value={selfHostedProvider}
                    onValueChange={(v) => setSelfHostedProvider(v as LLMProvider)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SELF_HOSTED_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

                {/* Model */}
                <div className="space-y-2">
                  <Label htmlFor="modelId">Model</Label>
                  <Select
                    value={modelId}
                    onValueChange={setModelId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Show saved modelId first if not in loaded models */}
                      {modelId && !models.find(m => m.id === modelId) && (
                        <SelectItem key={modelId} value={modelId}>
                          {modelId}
                        </SelectItem>
                      )}
                      {isLoadingModels && models.length === 0 && (
                        <SelectItem value="_loading" disabled>
                          Loading models...
                        </SelectItem>
                      )}
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {modelsError && (
                    <p className="text-xs text-destructive">{modelsError}</p>
                  )}
                </div>
              </>
            )}
          </div>
          </>)}
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
