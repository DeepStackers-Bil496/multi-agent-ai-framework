"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/utils";

export type TokenProvider = "github" | "google" | "custom";

export interface ConnectedAccount {
  id: string;
  provider: TokenProvider;
  scopes: string[];
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
}

export interface SaveTokenParams {
  provider: TokenProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export function useUserTokens() {
  const { data, error, isLoading, mutate } = useSWR<{
    tokens: ConnectedAccount[];
  }>("/api/settings/tokens", fetcher);

  const saveToken = async (
    params: SaveTokenParams
  ): Promise<{ success: boolean; id?: string }> => {
    try {
      const response = await fetch("/api/settings/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save token");
      }

      const result = await response.json();
      // Revalidate the tokens list
      mutate();
      return { success: true, id: result.id };
    } catch (error) {
      console.error("Error saving token:", error);
      throw error;
    }
  };

  const deleteToken = async (provider: TokenProvider): Promise<boolean> => {
    try {
      const response = await fetch(`/api/settings/tokens/${provider}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete token");
      }

      // Optimistically update the cache
      mutate(
        { tokens: (data?.tokens || []).filter((t) => t.provider !== provider) },
        false
      );
      return true;
    } catch (error) {
      console.error("Error deleting token:", error);
      throw error;
    }
  };

  const isConnected = (provider: TokenProvider): boolean => {
    const token = data?.tokens?.find((t) => t.provider === provider);
    return token ? !token.isExpired : false;
  };

  const getConnectionStatus = (
    provider: TokenProvider
  ): "connected" | "expired" | "disconnected" => {
    const token = data?.tokens?.find((t) => t.provider === provider);
    if (!token) return "disconnected";
    if (token.isExpired) return "expired";
    return "connected";
  };

  const getConnection = (provider: TokenProvider): ConnectedAccount | undefined => {
    return data?.tokens?.find((t) => t.provider === provider);
  };

  return {
    tokens: data?.tokens || [],
    isLoading,
    error,
    saveToken,
    deleteToken,
    isConnected,
    getConnectionStatus,
    getConnection,
    mutate,
  };
}
