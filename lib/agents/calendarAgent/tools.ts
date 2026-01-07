import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

type CalendarEnv = {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    calendarId: string;
    redirectUri: string;
};

const DEFAULT_REDIRECT_URI = "https://developers.google.com/oauthplayground";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

const calendarEnvSchema = z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    refreshToken: z.string().min(1),
    calendarId: z.string().min(1),
    redirectUri: z.string().min(1),
});

function getCalendarEnv(): CalendarEnv {
    const env = {
        clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "",
        refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || "",
        calendarId: process.env.GOOGLE_CALENDAR_CALENDAR_ID || "primary",
        redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    };

    return calendarEnvSchema.parse(env);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    const env = getCalendarEnv();
    const now = Date.now();

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
        throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    cachedToken = {
        token: data.access_token,
        expiresAt: now + data.expires_in * 1000,
    };

    return data.access_token;
}

async function calendarRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getAccessToken();
    const response = await fetch(`${CALENDAR_API_BASE}${path}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar API error: ${response.status} ${errorText}`);
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json() as Promise<T>;
}

const dateTimeRangeSchema = z.object({
    start: z.string().describe("ISO 8601 start datetime"),
    end: z.string().describe("ISO 8601 end datetime"),
    timeZone: z.string().optional().describe("IANA timezone, e.g. America/New_York"),
});

function formatDateTime(dateTime: string, timeZone?: string) {
    return {
        dateTime,
        timeZone,
    };
}

function formatEventSummary(event: { id?: string | null; summary?: string | null; start?: any; end?: any }) {
    const start = event.start?.dateTime || event.start?.date || "";
    const end = event.end?.dateTime || event.end?.date || "";
    return `- ${event.summary || "(no title)"} (${start} → ${end}) [${event.id ?? "no-id"}]`;
}

export function createEventTool() {
    return new DynamicStructuredTool({
        name: "create_event",
        description: "Create a Google Calendar event with title, time range, attendees, and optional description.",
        schema: z.object({
            summary: z.string().describe("Event title"),
            description: z.string().optional().describe("Event description"),
            location: z.string().optional().describe("Event location"),
            start: dateTimeRangeSchema.shape.start,
            end: dateTimeRangeSchema.shape.end,
            timeZone: dateTimeRangeSchema.shape.timeZone,
            attendees: z.array(z.string().email()).optional().describe("List of attendee email addresses"),
        }),
        func: async ({ summary, description, location, start, end, timeZone, attendees }) => {
            try {
                const { calendarId } = getCalendarEnv();
                const event = await calendarRequest<{ id?: string; summary?: string }>(
                    `/calendars/${encodeURIComponent(calendarId)}/events`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            summary,
                            description,
                            location,
                            start: formatDateTime(start, timeZone),
                            end: formatDateTime(end, timeZone),
                            attendees: attendees?.map(email => ({ email })) || undefined,
                        }),
                    }
                );

                return `Event created: ${event.summary || "(no title)"} (${event.id ?? "no-id"})`;
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return `Failed to create event: ${message}`;
            }
        },
    });
}

export function createListEventsTool() {
    return new DynamicStructuredTool({
        name: "list_events",
        description: "List upcoming Google Calendar events within an optional time range.",
        schema: z.object({
            timeMin: z.string().optional().describe("ISO 8601 start datetime filter"),
            timeMax: z.string().optional().describe("ISO 8601 end datetime filter"),
            maxResults: z.number().optional().default(10).describe("Maximum number of events to return"),
            query: z.string().optional().describe("Search query for event text"),
        }),
        func: async ({ timeMin, timeMax, maxResults, query }) => {
            try {
                const { calendarId } = getCalendarEnv();
                const params = new URLSearchParams();
                if (timeMin) params.set("timeMin", timeMin);
                if (timeMax) params.set("timeMax", timeMax);
                params.set("maxResults", String(maxResults ?? 10));
                params.set("singleEvents", "true");
                params.set("orderBy", "startTime");
                if (query) params.set("q", query);

                const response = await calendarRequest<{ items?: any[] }>(
                    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
                );

                const events = response.items ?? [];
                if (events.length === 0) {
                    return "No events found for the given criteria.";
                }

                return `Upcoming events:\n${events.map(formatEventSummary).join("\n")}`;
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return `Failed to list events: ${message}`;
            }
        },
    });
}

export function createUpdateEventTool() {
    return new DynamicStructuredTool({
        name: "update_event",
        description: "Update an existing Google Calendar event by ID.",
        schema: z.object({
            eventId: z.string().describe("Event ID to update"),
            summary: z.string().optional().describe("Updated title"),
            description: z.string().optional().describe("Updated description"),
            location: z.string().optional().describe("Updated location"),
            start: dateTimeRangeSchema.shape.start.optional(),
            end: dateTimeRangeSchema.shape.end.optional(),
            timeZone: dateTimeRangeSchema.shape.timeZone,
            attendees: z.array(z.string().email()).optional().describe("Updated attendee emails"),
        }),
        func: async ({ eventId, summary, description, location, start, end, timeZone, attendees }) => {
            try {
                const { calendarId } = getCalendarEnv();
                const event = await calendarRequest<{ id?: string; summary?: string }>(
                    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            summary,
                            description,
                            location,
                            start: start ? formatDateTime(start, timeZone) : undefined,
                            end: end ? formatDateTime(end, timeZone) : undefined,
                            attendees: attendees?.map(email => ({ email })) || undefined,
                        }),
                    }
                );

                return `Event updated: ${event.summary || "(no title)"} (${event.id ?? "no-id"})`;
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return `Failed to update event: ${message}`;
            }
        },
    });
}

export function createDeleteEventTool() {
    return new DynamicStructuredTool({
        name: "delete_event",
        description: "Delete an event from Google Calendar by ID.",
        schema: z.object({
            eventId: z.string().describe("Event ID to delete"),
        }),
        func: async ({ eventId }) => {
            try {
                const { calendarId } = getCalendarEnv();
                await calendarRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
                    { method: "DELETE" }
                );
                return `Event deleted: ${eventId}`;
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return `Failed to delete event: ${message}`;
            }
        },
    });
}

function parseDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid datetime: ${value}`);
    }
    return date;
}

export function createFindFreeSlotsTool() {
    return new DynamicStructuredTool({
        name: "find_free_slots",
        description: "Find free time slots within a range using Google Calendar free/busy data.",
        schema: z.object({
            timeMin: z.string().describe("ISO 8601 range start"),
            timeMax: z.string().describe("ISO 8601 range end"),
            durationMinutes: z.number().int().min(1).describe("Desired meeting length in minutes"),
            maxSlots: z.number().int().min(1).optional().default(5).describe("Maximum number of slots to return"),
            timeZone: z.string().optional().describe("IANA timezone for results"),
        }),
        func: async ({ timeMin, timeMax, durationMinutes, maxSlots, timeZone }) => {
            try {
                const { calendarId } = getCalendarEnv();
                const response = await calendarRequest<{ calendars?: Record<string, { busy?: { start?: string; end?: string }[] }> }>(
                    "/freeBusy",
                    {
                        method: "POST",
                        body: JSON.stringify({
                            timeMin,
                            timeMax,
                            timeZone,
                            items: [{ id: calendarId }],
                        }),
                    }
                );

                const busy = response.calendars?.[calendarId]?.busy ?? [];
                const rangeStart = parseDate(timeMin);
                const rangeEnd = parseDate(timeMax);

                if (rangeStart >= rangeEnd) {
                    return "Invalid range: timeMin must be before timeMax.";
                }

                const busyRanges = busy
                    .map(entry => ({
                        start: parseDate(entry.start || ""),
                        end: parseDate(entry.end || ""),
                    }))
                    .sort((a, b) => a.start.getTime() - b.start.getTime());

                const slots: { start: Date; end: Date }[] = [];
                let cursor = rangeStart;
                const durationMs = durationMinutes * 60 * 1000;

                for (const range of busyRanges) {
                    if (range.start >= rangeEnd) {
                        break;
                    }

                    if (cursor >= rangeEnd) {
                        break;
                    }

                    if (range.start > cursor) {
                        const gapEnd = range.start > rangeEnd ? rangeEnd : range.start;
                        const gap = gapEnd.getTime() - cursor.getTime();
                        if (gap >= durationMs) {
                            slots.push({ start: new Date(cursor), end: new Date(gapEnd) });
                            if (slots.length >= (maxSlots ?? 5)) break;
                        }
                    }

                    if (range.end > cursor) {
                        cursor = range.end;
                    }
                }

                if (slots.length < (maxSlots ?? 5) && rangeEnd > cursor) {
                    const gap = rangeEnd.getTime() - cursor.getTime();
                    if (gap >= durationMs) {
                        slots.push({ start: new Date(cursor), end: new Date(rangeEnd) });
                    }
                }

                if (slots.length === 0) {
                    return "No free slots found for the requested range.";
                }

                const formatted = slots
                    .slice(0, maxSlots ?? 5)
                    .map((slot, index) => `${index + 1}. ${slot.start.toISOString()} → ${slot.end.toISOString()}`)
                    .join("\n");

                return `Available slots:\n${formatted}`;
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown error";
                return `Failed to find free slots: ${message}`;
            }
        },
    });
}

export function createAllCalendarAgentTools(): DynamicStructuredTool[] {
    return [
        createEventTool(),
        createListEventsTool(),
        createUpdateEventTool(),
        createDeleteEventTool(),
        createFindFreeSlotsTool(),
    ];
}
