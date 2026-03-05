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

  await expect(page.getByTestId("toast")).toContainText(
    "Account created successfully!"
  );

  // ── Wait for the chat UI to be ready ─────────────────────────────────────
  // After registration the app redirects to "/" and hydrates the React shell.
  // We only need the session cookie to be set — we do NOT interact with the
  // model selector here because:
  //   • Route tests use adaContext.request (HTTP only) and never touch the page.
  //   • E2E tests call chooseModelFromSelector() themselves inside each test.
  // Trying to click the selector here races against hydration and causes
  // intermittent 30 s timeouts, so we skip it and just persist the session.
  await page.waitForURL("http://localhost:3000/");
  await page.waitForLoadState("domcontentloaded");

  await context.storageState({ path: storageFile });
  await page.close();

  // ── Return a fresh context backed by the saved session ───────────────────
  const newContext = await browser.newContext({ storageState: storageFile });
  const newPage = await newContext.newPage();

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
