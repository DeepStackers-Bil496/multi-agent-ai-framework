"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/utils";

export interface UserProfileData {
  fullName: string | null;
  nickname: string | null;
  workType: string | null;
  personalPreferences: string | null;
}

export interface NotificationSettings {
  notifyResponseCompletions: boolean;
  notifyEmails: boolean;
}

export function useUserProfile() {
  const {
    data: profileData,
    error: profileError,
    isLoading: profileLoading,
    mutate: mutateProfile,
  } = useSWR<{ profile: UserProfileData | null }>(
    "/api/settings/profile",
    fetcher
  );

  const {
    data: notificationsData,
    error: notificationsError,
    isLoading: notificationsLoading,
    mutate: mutateNotifications,
  } = useSWR<{ notifications: NotificationSettings }>(
    "/api/settings/notifications",
    fetcher
  );

  const updateProfile = async (data: Partial<UserProfileData>) => {
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const result = await response.json();
      mutateProfile({ profile: result.profile }, false);
      return result.profile;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  };

  const updateNotifications = async (data: Partial<NotificationSettings>) => {
    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update notifications");
      }

      const result = await response.json();
      mutateNotifications({ notifications: result.notifications }, false);
      return result.notifications;
    } catch (error) {
      console.error("Error updating notifications:", error);
      throw error;
    }
  };

  return {
    profile: profileData?.profile ?? null,
    notifications: notificationsData?.notifications ?? {
      notifyResponseCompletions: true,
      notifyEmails: false,
    },
    isLoading: profileLoading || notificationsLoading,
    error: profileError || notificationsError,
    updateProfile,
    updateNotifications,
    mutateProfile,
    mutateNotifications,
  };
}
