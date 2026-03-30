import { expect, type Page } from "@playwright/test";

export class ArtifactPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get artifact() {
    return this.page.getByTestId("artifact");
  }

  get sendButton() {
    return this.artifact.getByTestId("send-button");
  }

  get stopButton() {
    return this.page.getByTestId("stop-button");
  }

  get multimodalInput() {
    return this.page.getByTestId("multimodal-input");
  }

  private get documentContent() {
    return this.artifact.locator(".ProseMirror").first();
  }

  private async getAssistantMessageCount() {
    return this.artifact.getByTestId("message-assistant").count();
  }

  private async getLatestAssistantContent() {
    const messageCount = await this.getAssistantMessageCount();

    if (messageCount === 0) {
      return "";
    }

    return (
      (await this.artifact
        .getByTestId("message-assistant")
        .nth(messageCount - 1)
        .getByTestId("message-content")
        .textContent()
        .catch(() => "")) ?? ""
    ).trim();
  }

  private async waitForAssistantMessageUpdate({
    previousCount,
    previousContent,
    timeout = 15_000,
  }: {
    previousCount?: number;
    previousContent?: string;
    timeout?: number;
  } = {}) {
    const baselineCount =
      previousCount !== undefined ? previousCount : await this.getAssistantMessageCount();
    const baselineContent =
      previousContent !== undefined
        ? previousContent.trim()
        : await this.getLatestAssistantContent();

    await expect
      .poll(
        async () => {
          const messageCount = await this.getAssistantMessageCount();
          const content = await this.getLatestAssistantContent();

          if (
            (messageCount > baselineCount && content.length > 0) ||
            (content.length > 0 && content !== baselineContent)
          ) {
            return content;
          }

          return "";
        },
        {
          message: "Expected a new assistant response inside the artifact panel",
          timeout,
        }
      )
      .not.toBe("");
  }

  private async waitForLatestAssistantContent(timeout = 15_000) {
    await expect
      .poll(
        async () => {
          const content = await this.getLatestAssistantContent();
          return content.trim();
        },
        {
          message: "Expected artifact assistant content to be visible",
          timeout,
        }
      )
      .not.toBe("");
  }

  async isGenerationComplete(timeout = 15_000) {
    await expect(this.artifact).toBeVisible({ timeout });
    await expect(this.page.getByTestId("artifact-close-button")).toBeVisible({
      timeout,
    });
    await expect
      .poll(
        async () => {
          const content =
            (await this.documentContent.textContent().catch(() => "")) ?? "";
          return content.trim();
        },
        {
          message: "Expected artifact document content to be visible",
          timeout,
        }
      )
      .not.toBe("");
    await expect(this.stopButton).not.toBeVisible({ timeout });
    await expect(this.artifact.getByTestId("send-button")).toBeVisible({
      timeout,
    });
  }

  async sendUserMessage(message: string) {
    await this.artifact.getByTestId("multimodal-input").click();
    await this.artifact.getByTestId("multimodal-input").fill(message);
    await this.artifact.getByTestId("send-button").click();
  }

  async getRecentAssistantMessage({
    previousCount,
    previousContent,
    timeout = 15_000,
  }: {
    previousCount?: number;
    previousContent?: string;
    timeout?: number;
  } = {}) {
    if (previousCount !== undefined || previousContent !== undefined) {
      await this.waitForAssistantMessageUpdate({
        previousCount,
        previousContent,
        timeout,
      });
    } else {
      await this.waitForLatestAssistantContent(timeout);
    }

    const messageElements = await this.artifact
      .getByTestId("message-assistant")
      .all();
    const lastMessageElement = messageElements.at(-1);

    if (!lastMessageElement) {
      throw new Error("No assistant artifact message found");
    }

    const content =
      (await lastMessageElement.getByTestId("message-content").textContent())?.trim() ??
      "";

    const reasoningElement = await lastMessageElement
      .getByTestId("message-reasoning")
      .isVisible()
      .then(async (visible) =>
        visible
          ? await lastMessageElement
              .getByTestId("message-reasoning")
              .innerText()
          : null
      )
      .catch(() => null);

    return {
      element: lastMessageElement,
      content,
      reasoning: reasoningElement,
      async toggleReasoningVisibility() {
        await lastMessageElement
          .getByTestId("message-reasoning-toggle")
          .click();
      },
    };
  }

  async getRecentUserMessage() {
    const messageElements = await this.artifact
      .getByTestId("message-user")
      .all();
    const lastMessageElement = messageElements.at(-1);

    if (!lastMessageElement) {
      throw new Error("No user artifact message found");
    }

    const content = await lastMessageElement.innerText();

    const hasAttachments = await lastMessageElement
      .getByTestId("message-attachments")
      .isVisible()
      .catch(() => false);

    const attachments = hasAttachments
      ? await lastMessageElement.getByTestId("message-attachments").all()
      : [];

    const page = this.artifact;

    return {
      element: lastMessageElement,
      content,
      attachments,
      async edit(newMessage: string) {
        await page.getByTestId("message-edit-button").click();
        await page.getByTestId("message-editor").fill(newMessage);
        await page.getByTestId("message-editor-send-button").click();
        await expect(
          page.getByTestId("message-editor-send-button")
        ).not.toBeVisible();
      },
    };
  }

  closeArtifact() {
    return this.page.getByTestId("artifact-close-button").click();
  }
}
