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

  private async waitForRegularSession(email: string) {
    await expect
      .poll(
        async () => {
          const response = await this.page.context().request.get(
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

          if (sessionEmail !== email || sessionType !== "regular") {
            return null;
          }

          return `${sessionEmail}:${sessionType}`;
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
    await this.gotoLogin();
    await this.page.getByPlaceholder("user@acme.com").click();
    await this.page.getByPlaceholder("user@acme.com").fill(email);
    await this.page.getByLabel("Password").click();
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Sign In" }).click();
    await this.waitForRegularSession(email);
    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");
    await this.waitForRegularUserShell(email.split("@")[0]);
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
