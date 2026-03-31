import type { Page } from "@playwright/test";
import { expect } from "../fixtures";

export class AuthPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoLogin() {
    await this.page.goto("/login");
    await expect(this.page.getByRole("heading")).toContainText("Sign In");
  }

  async gotoRegister() {
    await this.page.goto("/register");
    await expect(this.page.getByRole("heading")).toContainText("Sign Up");
  }

  async register(email: string, password: string) {
    await this.gotoRegister();
    await this.page.getByPlaceholder("user@acme.com").click();
    await this.page.getByPlaceholder("user@acme.com").fill(email);
    await this.page.getByLabel("Password").click();
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Sign Up" }).click();
  }

  async ensureRegistered(email: string, password: string) {
    await this.register(email, password);

    const toast = this.page.getByTestId("toast");
    await expect(toast).toBeVisible();

    const toastText = (await toast.textContent()) ?? "";
    const accountCreated = toastText.includes("Account created successfully!");

    if (!accountCreated) {
      await expect(toast).toContainText("Account already exists!");
      return;
    }

    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");

    const userEmail = this.page.getByTestId("user-email");
    await expect(userEmail).toBeVisible();

    const userLabel = (await userEmail.textContent())?.trim() ?? "";

    if (userLabel !== "Guest") {
      await this.openSidebar();

      const userNavButton = this.page.getByTestId("user-nav-button");
      await expect(userNavButton).toBeVisible();

      await userNavButton.click();

      const authMenuItem = this.page.getByTestId("user-nav-item-auth");
      await expect(authMenuItem).toContainText("Sign out");
      await authMenuItem.click();

      await expect(this.page.getByTestId("user-email")).toContainText("Guest");
    }
  }

  private async waitForRegularSession(email: string) {
    await expect
      .poll(
        async () => {
          return this.page.evaluate(async (expectedEmail) => {
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

              if (
                sessionEmail !== expectedEmail ||
                sessionType !== "regular"
              ) {
                return null;
              }

              return `${sessionEmail}:${sessionType}`;
            } catch {
              return null;
            }
          }, email);
        },
        {
          message: "Expected login flow to replace the guest session",
          timeout: 15_000,
        }
      )
      .toBe(`${email}:regular`);
  }

  private async waitForRegularUserShell(expectedUsername: string) {
    const userEmail = this.page.getByTestId("user-email");

    const assertUserShell = async () => {
      await expect(userEmail).toBeVisible();
      await expect
        .poll(
          async () => {
            const text = (await userEmail.textContent())?.trim() ?? "";
            return text;
          },
          {
            message: "Expected login flow to hydrate a non-guest user session",
            timeout: 10_000,
          }
        )
        .not.toBe("Guest");
      await expect(userEmail).toContainText(expectedUsername);
    };

    try {
      await assertUserShell();
    } catch {
      await this.page.reload();
      await this.page.waitForLoadState("domcontentloaded");
      await assertUserShell();
    }
  }

  async login(email: string, password: string) {
    const username = email.split("@")[0];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.gotoLogin();
      await this.page.getByPlaceholder("user@acme.com").click();
      await this.page.getByPlaceholder("user@acme.com").fill(email);
      await this.page.getByLabel("Password").click();
      await this.page.getByLabel("Password").fill(password);
      await this.page.getByRole("button", { name: "Sign In" }).click();

      try {
        await this.page.waitForURL(
          (url) => !url.pathname.startsWith("/login"),
          { timeout: 15_000 }
        );
        await this.page.waitForLoadState("domcontentloaded");
        await this.waitForRegularUserShell(username);
        await this.waitForRegularSession(email).catch(() => {});
        return;
      } catch (error) {
        if (attempt === 1) {
          throw error;
        }
      }
    }
  }

  async logout(email: string, password: string) {
    await this.login(email, password);

    await this.openSidebar();

    const userNavButton = this.page.getByTestId("user-nav-button");
    await expect(userNavButton).toBeVisible();

    await userNavButton.click();
    const userNavMenu = this.page.getByTestId("user-nav-menu");
    await expect(userNavMenu).toBeVisible();

    const authMenuItem = this.page.getByTestId("user-nav-item-auth");
    await expect(authMenuItem).toContainText("Sign out");

    await authMenuItem.click();

    const userEmail = this.page.getByTestId("user-email");
    await expect(userEmail).toContainText("Guest");
  }

  async expectToastToContain(text: string) {
    await expect(this.page.getByTestId("toast")).toContainText(text);
  }

  async openSidebar() {
    const sidebarToggleButton = this.page.getByTestId("sidebar-toggle-button");
    await sidebarToggleButton.click({ force: true });
  }
}
