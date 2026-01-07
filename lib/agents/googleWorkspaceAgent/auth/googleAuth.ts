import { z } from "zod";

// API base URLs for Google Workspace services
export const API_BASES = {
    gmail: "https://gmail.googleapis.com/gmail/v1",
    calendar: "https://www.googleapis.com/calendar/v3",
    drive: "https://www.googleapis.com/drive/v3",
    docs: "https://docs.googleapis.com/v1",
    sheets: "https://sheets.googleapis.com/v4",
    slides: "https://slides.googleapis.com/v1",
} as const;

export type GoogleService = keyof typeof API_BASES;

const DEFAULT_REDIRECT_URI = "https://developers.google.com/oauthplayground";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const googleAuthEnvSchema = z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    refreshToken: z.string().min(1),
    redirectUri: z.string().min(1),
    calendarId: z.string().min(1),
});

export type GoogleAuthEnv = z.infer<typeof googleAuthEnvSchema>;

export function getGoogleAuthEnv(): GoogleAuthEnv {
    const env = {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
        redirectUri: process.env.GOOGLE_REDIRECT_URI || DEFAULT_REDIRECT_URI,
        calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    };

    return googleAuthEnvSchema.parse(env);
}

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid access token, refreshing if necessary.
 * Uses 60-second buffer before expiration.
 */
export async function getAccessToken(): Promise<string> {
    const env = getGoogleAuthEnv();
    const now = Date.now();

    // Return cached token if still valid (with 60-second buffer)
    if (cachedToken && cachedToken.expiresAt > now + 60_000) {
        return cachedToken.token;
    }

    const body = new URLSearchParams({
        client_id: env.clientId,
        client_secret: env.clientSecret,
        refresh_token: env.refreshToken,
        redirect_uri: env.redirectUri,
        grant_type: "refresh_token",
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh Google token: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    cachedToken = {
        token: data.access_token,
        expiresAt: now + data.expires_in * 1000,
    };

    return data.access_token;
}

/**
 * Generic Google API request helper with automatic token injection.
 */
export async function googleApiRequest<T>(
    service: GoogleService,
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const token = await getAccessToken();
    const baseUrl = API_BASES[service];
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google ${service} API error: ${response.status} ${errorText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return {} as T;
    }

    return response.json() as Promise<T>;
}

/**
 * Check if dry run mode is enabled (for testing without actual operations)
 */
export function isDryRunMode(): boolean {
    return process.env.GOOGLE_WORKSPACE_DRY_RUN === "true";
}
