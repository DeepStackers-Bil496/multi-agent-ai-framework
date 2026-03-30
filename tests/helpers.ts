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
import { ChatPage } from "./pages/chat";

export type UserContext = {
  context: BrowserContext;
  page: Page;
  request: APIRequestContext;
};

async function waitForAuthenticatedSession(context: BrowserContext) {
  await expect
    .poll(
      async () => {
        const cookies = await context.cookies();

        return cookies.some((cookie) => cookie.name.includes("session-token"));
      },
      {
        message: "Expected an auth session cookie after registration",
        timeout: 15_000,
      }
    )
    .toBe(true);
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

export async function createAuthenticatedContext({
  browser,
  name,
}: {
  browser: Browser;
  name: string;
}): Promise<UserContext> {
  const directory = path.join(__dirname, "../playwright/.sessions");

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const storageFile = path.join(directory, `${name}.json`);

  const context = await browser.newContext();
  const page = await context.newPage();

  const email = `test-${name}@playwright.com`;
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

  await waitForAuthenticatedSession(context);

  await context.storageState({ path: storageFile });
  await page.close();

  // ── Return a fresh context backed by the saved session ───────────────────
  const newContext = await browser.newContext({ storageState: storageFile });
  const newPage = await newContext.newPage();
  await newPage.goto("http://localhost:3000/");
  await newPage.waitForLoadState("domcontentloaded");

  return {
    context: newContext,
    page: newPage,
    request: newContext.request,
  };
}

export function generateRandomTestUser() {
  const email = `test-${getUnixTime(new Date())}@playwright.com`;
  const password = generateId();

  return {
    email,
    password,
  };
}
