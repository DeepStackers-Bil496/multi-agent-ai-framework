"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppearanceModeCard, type ThemeMode } from "../appearance-mode-card";
import { useUserProfile } from "@/hooks/use-user-profile";
import { toast } from "@/components/toast";
import { guestRegex } from "@/lib/constants";

const workTypes = [
  { value: "engineering", label: "Engineering" },
  { value: "design", label: "Design" },
  { value: "product", label: "Product Management" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales" },
  { value: "research", label: "Research" },
  { value: "student", label: "Student" },
  { value: "personal", label: "Personal Use" },
  { value: "other", label: "Other" },
];

export function GeneralTab() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const {
    profile,
    notifications,
    isLoading,
    updateProfile,
    updateNotifications,
  } = useUserProfile();

  const isGuest = guestRegex.test(session?.user?.email ?? "");

  // Local state for form fields
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [workType, setWorkType] = useState("");
  const [personalPreferences, setPersonalPreferences] = useState("");

  // Sync profile data to local state
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName ?? "");
      setNickname(profile.nickname ?? "");
      setWorkType(profile.workType ?? "");
      setPersonalPreferences(profile.personalPreferences ?? "");
    }
  }, [profile]);

  // Debounced save for text fields
  const handleProfileUpdate = async (
    field: string,
    value: string
  ) => {
    if (isGuest) {
      toast({
        type: "error",
        description: "Please login to save your settings",
      });
      return;
    }

    try {
      await updateProfile({ [field]: value || null });
    } catch {
      toast({
        type: "error",
        description: "Failed to save settings",
      });
    }
  };

  const handleNotificationUpdate = async (
    field: "notifyResponseCompletions" | "notifyEmails",
    value: boolean
  ) => {
    if (isGuest) {
      toast({
        type: "error",
        description: "Please login to save your settings",
      });
      return;
    }

    try {
      await updateNotifications({ [field]: value });
    } catch {
      toast({
        type: "error",
        description: "Failed to save notification settings",
      });
    }
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">General</h2>
        <p className="text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Tell us about yourself to personalize your experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => handleProfileUpdate("fullName", fullName)}
                disabled={isGuest}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">What should we call you?</Label>
              <Input
                id="nickname"
                placeholder="Enter a nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => handleProfileUpdate("nickname", nickname)}
                disabled={isGuest}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workType">What best describes your work?</Label>
            <Select
              value={workType}
              onValueChange={(value) => {
                setWorkType(value);
                handleProfileUpdate("workType", value);
              }}
              disabled={isGuest}
            >
              <SelectTrigger id="workType">
                <SelectValue placeholder="Select your work type" />
              </SelectTrigger>
              <SelectContent>
                {workTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="personalPreferences">Personal preferences</Label>
            <Textarea
              id="personalPreferences"
              placeholder="Add any context or preferences you'd like us to know about..."
              value={personalPreferences}
              onChange={(e) => setPersonalPreferences(e.target.value)}
              onBlur={() =>
                handleProfileUpdate("personalPreferences", personalPreferences)
              }
              disabled={isGuest}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This helps personalize your AI interactions
            </p>
          </div>

          {isGuest && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Login to save your profile settings
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Configure how you receive updates and alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Response completions</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when AI responses are complete
              </p>
            </div>
            <Switch
              checked={notifications.notifyResponseCompletions}
              onCheckedChange={(checked) =>
                handleNotificationUpdate("notifyResponseCompletions", checked)
              }
              disabled={isGuest}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email updates and announcements
              </p>
            </div>
            <Switch
              checked={notifications.notifyEmails}
              onCheckedChange={(checked) =>
                handleNotificationUpdate("notifyEmails", checked)
              }
              disabled={isGuest}
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Label>Color mode</Label>
            <div className="grid grid-cols-3 gap-4">
              <AppearanceModeCard
                mode="system"
                currentMode={(theme as ThemeMode) ?? "system"}
                onSelect={handleThemeChange}
              />
              <AppearanceModeCard
                mode="light"
                currentMode={(theme as ThemeMode) ?? "system"}
                onSelect={handleThemeChange}
              />
              <AppearanceModeCard
                mode="dark"
                currentMode={(theme as ThemeMode) ?? "system"}
                onSelect={handleThemeChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
