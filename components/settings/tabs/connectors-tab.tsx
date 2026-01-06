"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Github, Mail, Globe, Database, Plug, ExternalLink } from "lucide-react";

const connectors = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect to GitHub for repository access and operations",
    icon: Github,
    status: "available",
    configurable: false,
  },
  {
    id: "email",
    name: "Email (SMTP)",
    description: "Send emails through your configured SMTP server",
    icon: Mail,
    status: "available",
    configurable: false,
  },
  {
    id: "web",
    name: "Web Scraping",
    description: "Extract content from web pages",
    icon: Globe,
    status: "available",
    configurable: false,
  },
  {
    id: "codebase",
    name: "Codebase RAG",
    description: "Semantic search across your indexed codebase",
    icon: Database,
    status: "available",
    configurable: false,
  },
];

const futureConnectors = [
  {
    id: "slack",
    name: "Slack",
    description: "Integrate with Slack for team communication",
    icon: Plug,
    status: "coming_soon",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Access and manage Notion pages and databases",
    icon: Plug,
    status: "coming_soon",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Create and manage Jira issues and projects",
    icon: Plug,
    status: "coming_soon",
  },
];

export function ConnectorsTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Connectors</h2>
        <p className="text-muted-foreground">
          Manage integrations with external services
        </p>
      </div>

      {/* Active Connectors */}
      <Card>
        <CardHeader>
          <CardTitle>Active Connectors</CardTitle>
          <CardDescription>
            Services currently integrated with the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectors.map((connector) => {
            const Icon = connector.icon;
            return (
              <div
                key={connector.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{connector.name}</p>
                      <Badge
                        variant="outline"
                        className="text-xs text-green-600 border-green-600"
                      >
                        Active
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {connector.description}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" disabled>
                  Configure
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Upcoming integrations we are working on
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {futureConnectors.map((connector) => {
            const Icon = connector.icon;
            return (
              <div
                key={connector.id}
                className="flex items-center justify-between rounded-lg border border-dashed p-4 opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{connector.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        Coming Soon
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {connector.description}
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
    </div>
  );
}
