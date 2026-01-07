"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Github,
  Mail,
  Globe,
  Database,
  ExternalLink,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  useUserTokens,
  type TokenProvider,
  type ConnectedAccount,
} from "@/hooks/use-user-tokens";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ConnectorConfig {
  id: TokenProvider;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  helpUrl?: string;
  scopeOptions?: string[];
}

// Configurable connectors that support user tokens
const configurableConnectors: ConnectorConfig[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect to GitHub for repository access and operations",
    icon: Github,
    helpUrl: "https://github.com/settings/tokens",
    scopeOptions: ["repo", "read:user", "read:org"],
  },
  {
    id: "google",
    name: "Google",
    description: "Connect to Google services (Gmail, Calendar, Drive)",
    icon: Mail,
    helpUrl: "https://console.cloud.google.com/apis/credentials",
  },
];

// Built-in services that don't require user tokens
const builtInServices = [
  {
    id: "web",
    name: "Web Scraping",
    description: "Extract content from web pages",
    icon: Globe,
  },
  {
    id: "codebase",
    name: "Codebase RAG",
    description: "Semantic search across your indexed codebase",
    icon: Database,
  },
];

function ConnectorCard({
  connector,
  connection,
  onConnect,
  onDisconnect,
  isLoading,
}: {
  connector: ConnectorConfig;
  connection?: ConnectedAccount;
  onConnect: () => void;
  onDisconnect: () => void;
  isLoading: boolean;
}) {
  const Icon = connector.icon;
  const status = connection
    ? connection.isExpired
      ? "expired"
      : "connected"
    : "disconnected";

  const statusConfig = {
    connected: {
      badge: "Connected",
      color: "text-green-600 border-green-600",
      icon: Check,
    },
    expired: {
      badge: "Expired",
      color: "text-yellow-600 border-yellow-600",
      icon: AlertCircle,
    },
    disconnected: {
      badge: "Not Connected",
      color: "text-muted-foreground border-muted-foreground",
      icon: X,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-lg p-2 ${status === "connected" ? "bg-primary/10" : "bg-muted"}`}
        >
          <Icon
            className={`h-5 w-5 ${status === "connected" ? "text-primary" : "text-muted-foreground"}`}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{connector.name}</p>
            <Badge variant="outline" className={`text-xs ${config.color}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {config.badge}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {connector.description}
          </p>
          {connection &&
            typeof connection.metadata?.username === "string" && (
              <p className="text-xs text-muted-foreground mt-1">
                Connected as: {connection.metadata.username}
              </p>
            )}
        </div>
      </div>
      <div className="flex gap-2">
        {status === "connected" || status === "expired" ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDisconnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Disconnect"
            )}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Connect"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ConnectorsTab() {
  const { tokens, isLoading, saveToken, deleteToken, getConnection } =
    useUserTokens();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] =
    useState<ConnectorConfig | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleConnect = (connector: ConnectorConfig) => {
    setSelectedConnector(connector);
    setTokenInput("");
    setConnectDialogOpen(true);
  };

  const handleDisconnect = async (provider: TokenProvider) => {
    try {
      setIsSaving(true);
      await deleteToken(provider);
      toast.success(`Disconnected from ${provider}`);
    } catch (_error) {
      toast.error("Failed to disconnect");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToken = async () => {
    if (!selectedConnector || !tokenInput.trim()) return;

    try {
      setIsSaving(true);
      await saveToken({
        provider: selectedConnector.id,
        accessToken: tokenInput.trim(),
        scopes: selectedConnector.scopeOptions || [],
      });
      toast.success(`Connected to ${selectedConnector.name}`);
      setConnectDialogOpen(false);
    } catch (_error) {
      toast.error("Failed to save token");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Connectors</h2>
        <p className="text-muted-foreground">
          Manage integrations with external services
        </p>
      </div>

      {/* External Services (Configurable) */}
      <Card>
        <CardHeader>
          <CardTitle>External Services</CardTitle>
          <CardDescription>
            Connect your accounts to enable agent capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            configurableConnectors.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                connection={getConnection(connector.id)}
                onConnect={() => handleConnect(connector)}
                onDisconnect={() => handleDisconnect(connector.id)}
                isLoading={isSaving}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Built-in Services */}
      <Card>
        <CardHeader>
          <CardTitle>Built-in Services</CardTitle>
          <CardDescription>
            Services available without additional configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {builtInServices.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{service.name}</p>
                      <Badge
                        variant="outline"
                        className="text-xs text-green-600 border-green-600"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Need a Custom Integration?</CardTitle>
          <CardDescription>
            Learn how to build and deploy custom MCP servers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            <ExternalLink className="mr-2 h-4 w-4" />
            View Documentation
          </Button>
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to {selectedConnector?.name}</DialogTitle>
            <DialogDescription>
              Enter your access token to connect this service.
              {selectedConnector?.helpUrl && (
                <>
                  {" "}
                  <a
                    href={selectedConnector.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Get a token <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="token">Access Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Enter your access token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
              />
            </div>
            {selectedConnector?.scopeOptions &&
              selectedConnector.scopeOptions.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Recommended scopes:{" "}
                  {selectedConnector.scopeOptions.join(", ")}
                </div>
              )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConnectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveToken}
              disabled={!tokenInput.trim() || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
