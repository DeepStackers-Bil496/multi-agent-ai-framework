"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Eye, Shield } from "lucide-react";

export function PrivacyTab() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Privacy</h2>
        <p className="text-muted-foreground">
          Control your data and privacy settings
        </p>
      </div>

      {/* Data Collection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Data Collection
          </CardTitle>
          <CardDescription>
            Manage how your data is collected and used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Usage analytics</Label>
              <p className="text-sm text-muted-foreground">
                Help improve the product by sharing anonymous usage data
              </p>
            </div>
            <Switch disabled />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Conversation history</Label>
              <p className="text-sm text-muted-foreground">
                Store conversation history for continuity
              </p>
            </div>
            <Switch defaultChecked disabled />
          </div>

          <p className="text-xs text-muted-foreground">
            Privacy controls coming soon
          </p>
        </CardContent>
      </Card>

      {/* Data Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Security
          </CardTitle>
          <CardDescription>
            Your data is encrypted and securely stored
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                All data is encrypted at rest
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                TLS encryption for data in transit
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                No third-party data sharing
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export or delete your personal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Data</p>
              <p className="text-sm text-muted-foreground">
                Download a copy of all your data
              </p>
            </div>
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Chat History</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete all conversation history
              </p>
            </div>
            <Button variant="destructive" disabled>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Data management features coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
