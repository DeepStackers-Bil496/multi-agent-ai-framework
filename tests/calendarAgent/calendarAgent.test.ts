import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEventTool, createListEventsTool, createFindFreeSlotsTool } from "../../lib/agents/calendarAgent/tools";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

type MockResponse = {
    status: number;
    body?: unknown;
};

function buildResponse({ status, body }: MockResponse) {
    return new Response(body ? JSON.stringify(body) : undefined, { status });
}

describe("CalendarAgent tools", () => {
    beforeEach(() => {
        process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
        process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = "refresh-token";
        process.env.GOOGLE_CALENDAR_CALENDAR_ID = "primary";
        process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://developers.google.com/oauthplayground";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    it("creates an event", async () => {
        global.fetch = async (input, init) => {
            const url = typeof input === "string" ? input : input.url;
            if (url === TOKEN_ENDPOINT) {
                return buildResponse({ status: 200, body: { access_token: "token", expires_in: 3600 } });
            }

            if (url === `${CALENDAR_API_BASE}/calendars/primary/events`) {
                assert.equal(init?.method, "POST");
                return buildResponse({ status: 200, body: { id: "event-1", summary: "Standup" } });
            }

            throw new Error(`Unexpected URL: ${url}`);
        };

        const tool = createEventTool();
        const result = await tool.func({
            summary: "Standup",
            start: "2025-01-01T10:00:00Z",
            end: "2025-01-01T10:30:00Z",
        });

        assert.match(result, /Event created/);
        assert.match(result, /event-1/);
    });

    it("lists upcoming events", async () => {
        global.fetch = async (input, init) => {
            const url = typeof input === "string" ? input : input.url;
            if (url === TOKEN_ENDPOINT) {
                return buildResponse({ status: 200, body: { access_token: "token", expires_in: 3600 } });
            }

            if (url.startsWith(`${CALENDAR_API_BASE}/calendars/primary/events?`)) {
                assert.equal(init?.method ?? "GET", "GET");
                return buildResponse({
                    status: 200,
                    body: {
                        items: [
                            { id: "event-2", summary: "Demo", start: { dateTime: "2025-02-01T10:00:00Z" }, end: { dateTime: "2025-02-01T11:00:00Z" } },
                        ],
                    },
                });
            }

            throw new Error(`Unexpected URL: ${url}`);
        };

        const tool = createListEventsTool();
        const result = await tool.func({
            timeMin: "2025-02-01T00:00:00Z",
            timeMax: "2025-02-02T00:00:00Z",
            maxResults: 5,
        });

        assert.match(result, /Upcoming events/);
        assert.match(result, /Demo/);
    });

    it("finds free slots", async () => {
        global.fetch = async (input) => {
            const url = typeof input === "string" ? input : input.url;
            if (url === TOKEN_ENDPOINT) {
                return buildResponse({ status: 200, body: { access_token: "token", expires_in: 3600 } });
            }

            if (url === `${CALENDAR_API_BASE}/freeBusy`) {
                return buildResponse({
                    status: 200,
                    body: {
                        calendars: {
                            primary: {
                                busy: [
                                    { start: "2025-03-01T10:00:00Z", end: "2025-03-01T10:30:00Z" },
                                    { start: "2025-03-01T12:00:00Z", end: "2025-03-01T12:30:00Z" },
                                ],
                            },
                        },
                    },
                });
            }

            throw new Error(`Unexpected URL: ${url}`);
        };

        const tool = createFindFreeSlotsTool();
        const result = await tool.func({
            timeMin: "2025-03-01T09:00:00Z",
            timeMax: "2025-03-01T13:00:00Z",
            durationMinutes: 30,
            maxSlots: 3,
        });

        assert.match(result, /Available slots/);
    });
});
