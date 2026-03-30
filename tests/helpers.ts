import fs from "node:fs";
import path from "node:path";
import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
} from "@playwright/test";
import { generateId } from "ai";
import { getUnixTime } from "date-fns";

export type UserContext = {
  context: BrowserContext;
  page: Page;
  request: APIRequestContext;
};

type AuthenticatedContextOptions = {
  browser: Browser;
  name: string;
  navigateToRoot?: boolean;
};

async function waitForAuthenticatedSession(
  context: BrowserContext,
  {
    expectedEmail,
    expectedType = "regular",
  }: {
    expectedEmail?: string;
    expectedType?: "guest" | "regular";
  } = {}
) {
  await expect
    .poll(
      async () => {
        const response = await context.request.get(
          "http://localhost:3000/api/auth/session"
        );

        if (!response.ok()) {
          return null;
        }

        const session = await response.json().catch(() => null);
        const sessionEmail =
          typeof session?.user?.email === "string" ? session.user.email : null;
        const sessionType =
          typeof session?.user?.type === "string" ? session.user.type : null;

        if (expectedEmail && sessionEmail !== expectedEmail) {
          return null;
        }

        if (sessionType !== expectedType) {
          return null;
        }

        return expectedEmail
          ? `${sessionEmail}:${sessionType}`
          : sessionType;
      },
      {
        message: "Expected the browser context to have a hydrated auth session",
        timeout: 15_000,
      }
    )
    .toBe(expectedEmail ? `${expectedEmail}:${expectedType}` : expectedType);
}

async function waitForRegularUserShell(page: Page, expectedUsername?: string) {
  const userEmail = page.getByTestId("user-email");

  await expect(userEmail).toBeVisible();
  await expect
    .poll(
      async () => {
        const text = (await userEmail.textContent())?.trim() ?? "";
        return text;
      },
      {
        message: "Expected authenticated shell to reflect a non-guest user",
        timeout: 15_000,
      }
    )
    .not.toBe("Guest");

  if (expectedUsername) {
    await expect(userEmail).toContainText(expectedUsername);
  }
}

async function signInWithCredentials({
  page,
  email,
  password,
}: {
  page: Page;
  email: string;
  password: string;
}) {
  await page.goto("http://localhost:3000/login");
  await page.getByPlaceholder("user@acme.com").click();
  await page.getByPlaceholder("user@acme.com").fill(email);
  await page.getByLabel("Password").click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

function buildTestEmail(name: string) {
  const safePrefix = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  const uniqueSuffix = generateId().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);

  return `pw-${safePrefix}-${uniqueSuffix}@playwright.dev`;
}

export async function createAuthenticatedContext({
  browser,
  name,
  navigateToRoot = true,
}: AuthenticatedContextOptions): Promise<UserContext> {
  const directory = path.join(__dirname, "../playwright/.sessions");

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const storageFile = path.join(directory, `${name}.json`);

  const context = await browser.newContext();
  const page = await context.newPage();

  const email = buildTestEmail(name);
  const password = generateId();

  // ── Register the user ────────────────────────────────────────────────────
  await page.goto("http://localhost:3000/register");
  await page.getByPlaceholder("user@acme.com").click();
  await page.getByPlaceholder("user@acme.com").fill(email);
  await page.getByLabel("Password").click();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();

  const toast = page.getByTestId("toast");
  await expect(toast).toBeVisible();
  const toastText = (await toast.textContent()) ?? "";

  if (!toastText.includes("Account created successfully!")) {
    await signInWithCredentials({ page, email, password });
  }

  await waitForAuthenticatedSession(context, {
    expectedEmail: email,
    expectedType: "regular",
  });

  await context.storageState({ path: storageFile });
  await page.close();

  // ── Return a fresh context backed by the saved session ───────────────────
  const newContext = await browser.newContext({ storageState: storageFile });
  const newPage = await newContext.newPage();

  if (navigateToRoot) {
    await newPage.goto("http://localhost:3000/");
    await newPage.waitForLoadState("domcontentloaded");
    await waitForRegularUserShell(newPage, email.split("@")[0]);
  }

  return {
    context: newContext,
    page: newPage,
    request: newContext.request,
  };
}

export async function createAuthenticatedRequestContext({
  browser,
  name,
}: {
  browser: Browser;
  name: string;
}): Promise<UserContext> {
  return createAuthenticatedContext({
    browser,
    name,
    navigateToRoot: false,
  });
}

export function generateRandomTestUser() {
  const email = buildTestEmail(`session-${getUnixTime(new Date())}`);
  const password = generateId();

  return {
    email,
    password,
  };
}
