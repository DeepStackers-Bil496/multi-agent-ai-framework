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
  page: Page,
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
        return page.evaluate(
          async ({ email, type }) => {
            try {
              const response = await fetch("/api/auth/session", {
                credentials: "include",
              });

              if (!response.ok()) {
                return null;
              }

              const session = await response.json().catch(() => null);
              const sessionEmail =
                typeof session?.user?.email === "string"
                  ? session.user.email
                  : null;
              const sessionType =
                typeof session?.user?.type === "string"
                  ? session.user.type
                  : null;

              if (email && sessionEmail !== email) {
                return null;
              }

              if (sessionType !== type) {
                return null;
              }

              return email ? `${sessionEmail}:${sessionType}` : sessionType;
            } catch {
              return null;
            }
          },
          {
            email: expectedEmail,
            type: expectedType,
          }
        );
      },
      {
        message: "Expected the browser context to have a hydrated auth session",
        timeout: 15_000,
      }
    )
    .toBe(expectedEmail ? `${expectedEmail}:${expectedType}` : expectedType);
}

async function waitForAuthenticatedRequestSession(
  request: APIRequestContext,
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
        try {
          const response = await request.get(
            "http://localhost:3000/api/auth/session"
          );

          if (!response.ok()) {
            return null;
          }

          const session = await response.json().catch(() => null);
          const sessionEmail =
            typeof session?.user?.email === "string"
              ? session.user.email
              : null;
          const sessionType =
            typeof session?.user?.type === "string"
              ? session.user.type
              : null;

          if (expectedEmail && sessionEmail !== expectedEmail) {
            return null;
          }

          if (sessionType !== expectedType) {
            return null;
          }

          return expectedEmail
            ? `${sessionEmail}:${sessionType}`
            : sessionType;
        } catch {
          return null;
        }
      },
      {
        message: "Expected persisted storage state to carry an auth session",
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

async function createAuthenticatedContextOnce({
  browser,
  name,
  navigateToRoot,
}: AuthenticatedContextOptions): Promise<UserContext> {
  const directory = path.join(__dirname, "../playwright/.sessions");

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const storageFile = path.join(directory, `${name}.json`);
  const setupContext = await browser.newContext();
  let newContext: BrowserContext | null = null;

  try {
    const page = await setupContext.newPage();
    const email = buildTestEmail(name);
    const password = generateId();
    const username = email.split("@")[0];

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

    await page.goto("http://localhost:3000/");
    await page.waitForLoadState("domcontentloaded");
    await waitForRegularUserShell(page, username);
    await waitForAuthenticatedSession(page, {
      expectedEmail: email,
      expectedType: "regular",
    }).catch(() => {});

    await setupContext.storageState({ path: storageFile });
    await setupContext.close();

    newContext = await browser.newContext({ storageState: storageFile });
    const newPage = await newContext.newPage();

    await waitForAuthenticatedRequestSession(newContext.request, {
      expectedEmail: email,
      expectedType: "regular",
    });

    if (navigateToRoot) {
      await newPage.goto("http://localhost:3000/");
      await newPage.waitForLoadState("domcontentloaded");
      await waitForRegularUserShell(newPage, username);
    }

    return {
      context: newContext,
      page: newPage,
      request: newContext.request,
    };
  } catch (error) {
    await setupContext.close().catch(() => {});
    await newContext?.close().catch(() => {});
    throw error;
  }
}

export async function createAuthenticatedContext({
  browser,
  name,
  navigateToRoot = true,
}: AuthenticatedContextOptions): Promise<UserContext> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await createAuthenticatedContextOnce({
        browser,
        name,
        navigateToRoot,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
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
