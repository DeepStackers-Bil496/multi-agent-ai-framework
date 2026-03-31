import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Tests for middleware.ts
 *
 * The middleware handles:
 * 1. /ping → 200 pong (used by Playwright to check server is up)
 * 2. /api/auth/* → pass-through
 * 3. No token → redirect to /api/auth/guest
 * 4. Authenticated non-guest on /login → redirect to /
 *
 * We mock next-auth/jwt getToken to control auth state.
 */

const mockGetToken = vi.fn();

vi.mock("next-auth/jwt", () => ({
  getToken: mockGetToken,
}));

vi.mock("@/lib/constants", () => ({
  guestRegex: /^guest-\d+$/,
  isDevelopmentEnvironment: true,
}));

function makeRequest(pathname: string, baseUrl = "http://localhost:3000"): NextRequest {
  return {
    nextUrl: { pathname },
    url: `${baseUrl}${pathname}`,
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("middleware", () => {
  let middleware: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    mockGetToken.mockReset();
    const mod = await import("@/middleware");
    middleware = mod.middleware as typeof middleware;
  });

  it("returns 200 pong for /ping", async () => {
    const req = makeRequest("/ping");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe("pong");
  });

  it("passes through /api/auth/* without token check", async () => {
    const req = makeRequest("/api/auth/session");
    const res = await middleware(req);
    // NextResponse.next() returns a response — we just check getToken was NOT called
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("redirects to /api/auth/guest when no token is present", async () => {
    mockGetToken.mockResolvedValue(null);
    const req = makeRequest("/");
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const location = res.headers.get("location");
    expect(location).toContain("/api/auth/guest");
  });

  it("redirects authenticated non-guest users from /login to /", async () => {
    mockGetToken.mockResolvedValue({ email: "user@example.com" });
    const req = makeRequest("/login");
    const res = await middleware(req);
    const location = res.headers.get("location");
    expect(location).toContain("/");
    expect(location).not.toContain("/login");
  });

  it("allows authenticated guest user to access /login", async () => {
    mockGetToken.mockResolvedValue({ email: "guest-42" }); // real format: guest-\d+
    const req = makeRequest("/login");
    const res = await middleware(req);
    // Should call next() not redirect
    expect(res.status).not.toBeGreaterThanOrEqual(300);
  });
});
