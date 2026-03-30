import { expect, type Page, type Response } from "@playwright/test";
import { chatModels } from "@/lib/ai/models";

const CHAT_ID_REGEX =
  /^http:\/\/localhost:3000\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export class ChatPage {
  private readonly page: Page;
  private pendingChatResponse: Promise<Response | null> | null = null;
  private pendingVoteResponse: Promise<Response> | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  get sendButton() {
    return this.page.getByTestId("send-button");
  }

  get stopButton() {
    return this.page.getByTestId("stop-button");
  }

  get multimodalInput() {
    return this.page.getByTestId("multimodal-input");
  }

  private get fallbackMultimodalInput() {
    return this.page.locator('textarea[name="message"]').first();
  }

  get scrollContainer() {
    return this.page.getByTestId("messages-scroll-container");
  }

  get scrollToBottomButton() {
    return this.page.getByTestId("scroll-to-bottom-button");
  }

  get modelSelector() {
    return this.page.getByTestId("model-selector");
  }

  private async getActiveMultimodalInput(timeout = 30_000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const primaryInputVisible = await this.multimodalInput
        .isVisible()
        .catch(() => false);

      if (primaryInputVisible) {
        return this.multimodalInput;
      }

      const fallbackInputVisible = await this.fallbackMultimodalInput
        .isVisible()
        .catch(() => false);

      if (fallbackInputVisible) {
        return this.fallbackMultimodalInput;
      }

      await this.page.waitForTimeout(100);
    }

    return this.multimodalInput;
  }

  async waitForBaseChatShellReady(timeout = 30_000) {
    await expect(this.page.getByTestId("sidebar-toggle-button")).toBeVisible({
      timeout,
    });
    await expect(this.scrollContainer).toBeVisible({ timeout });
  }

  private armChatResponseWaiter() {
    if (!this.pendingChatResponse) {
      this.pendingChatResponse = this.page
        .waitForResponse(
          (currentResponse) =>
            currentResponse.url().includes("/api/chat") &&
            currentResponse.request().method() === "POST"
        )
        .catch(() => null);
    }

    return this.pendingChatResponse;
  }

  private armVoteResponseWaiter() {
    if (!this.pendingVoteResponse) {
      this.pendingVoteResponse = this.page.waitForResponse(
        (currentResponse) =>
          currentResponse.url().includes("/api/vote") &&
          currentResponse.request().method() === "PATCH"
      );
    }

    return this.pendingVoteResponse;
  }

  async waitForChatShellReady() {
    await expect(await this.getActiveMultimodalInput()).toBeVisible();
    await expect(this.sendButton).toBeVisible();
    await expect(this.modelSelector).toBeVisible();
    await expect(this.page.getByTestId("sidebar-toggle-button")).toBeVisible();
    await expect(this.page.getByTestId("user-nav-button")).toBeVisible();
  }

  async waitForChatInputReady() {
    const activeInput = await this.getActiveMultimodalInput();
    await expect(activeInput).toBeVisible();
    await expect(activeInput).toBeEnabled();
    await expect(this.stopButton).not.toBeVisible();

    const sendButtonVisible = await this.sendButton.isVisible().catch(() => false);
    if (!sendButtonVisible) {
      await expect(this.sendButton).toBeVisible();
    }
  }

  async getAssistantMessageCount() {
    return this.scrollContainer.getByTestId("message-assistant").count();
  }

  private normalizeAssistantContent(content: string) {
    const normalized = content
      .replace(/thought for \d+s·/gi, "")
      .replace(/\b(speak|copy|upvote response|downvote response)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    return normalized;
  }

  private async findLatestAssistantMessageWithContent() {
    const messageCount = await this.getAssistantMessageCount();

    if (messageCount === 0) {
      return null;
    }

    const assistantMessages = this.scrollContainer.getByTestId("message-assistant");

    for (let index = messageCount - 1; index >= 0; index -= 1) {
      const messageElement = assistantMessages.nth(index);
      const content = (
        (await messageElement
          .getByTestId("message-content")
          .first()
          .innerText()
          .catch(() => "")) ?? ""
      ).trim();

      const normalizedContent = this.normalizeAssistantContent(content);

      if (normalizedContent.length > 0) {
        return {
          element: messageElement,
          content: normalizedContent,
        };
      }
    }

    return null;
  }

  private async getLatestAssistantContent() {
    const latestMessage = await this.findLatestAssistantMessageWithContent();
    return latestMessage?.content ?? "";
  }

  async waitForAssistantMessageUpdate({
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
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const messageCount = await this.getAssistantMessageCount();

      if (messageCount > 0) {
        const content = await this.getLatestAssistantContent();

        if (
          (messageCount > baselineCount && content.length > 0) ||
          (content.length > 0 && content !== baselineContent)
        ) {
          return content;
        }
      }

      await this.page.waitForTimeout(100);
    }

    throw new Error(
      `Timed out waiting for assistant content after ${timeout}ms`
    );
  }

  private async waitForLatestAssistantContent(timeout = 15_000) {
    await expect
      .poll(
        async () => {
          const content = await this.getLatestAssistantContent();
          return content.trim();
        },
        {
          message: "Expected the latest assistant message to have content",
          timeout,
        }
      )
      .not.toBe("");
  }

  async waitForInputInteractive(timeout = 15_000) {
    const activeInput = await this.getActiveMultimodalInput(timeout);
    await expect(activeInput).toBeVisible({ timeout });
    await expect(activeInput).toBeEnabled({ timeout });
    await expect(this.stopButton).not.toBeVisible({ timeout });
    await expect(this.sendButton).toBeVisible({ timeout });
  }

  async createNewChat() {
    await this.page.goto("/");
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForLoadState("networkidle").catch(() => {});
    await this.waitForBaseChatShellReady();
  }

  getCurrentURL(): string {
    return this.page.url();
  }

  async setChatRequestHeaders(headers: Record<string, string>) {
    await this.page.route("**/api/chat", async (route) => {
      const request = route.request();

      await route.continue({
        headers: {
          ...request.headers(),
          ...headers,
        },
      });
    });
  }

  async sendUserMessage(message: string) {
    await this.waitForChatInputReady();
    const activeInput = await this.getActiveMultimodalInput();
    this.armChatResponseWaiter();
    await activeInput.click();
    await activeInput.fill(message);
    await this.sendButton.click();
  }

  async isGenerationComplete({
    previousAssistantCount,
    previousAssistantContent,
    timeout = 15_000,
  }: {
    previousAssistantCount?: number;
    previousAssistantContent?: string;
    timeout?: number;
  } = {}) {
    const baselineCount =
      previousAssistantCount !== undefined
        ? previousAssistantCount
        : await this.getAssistantMessageCount();
    const baselineContent =
      previousAssistantContent !== undefined
        ? previousAssistantContent.trim()
        : await this.getLatestAssistantContent();
    const pendingResponse = this.pendingChatResponse;
    this.pendingChatResponse = null;

    if (pendingResponse) {
      const response = await pendingResponse;
      await response?.finished().catch(() => {});
    }

    const hasExplicitAssistantBaseline =
      previousAssistantCount !== undefined ||
      previousAssistantContent !== undefined;
    const currentAssistantContent = await this.getLatestAssistantContent();
    const currentAssistantCount = await this.getAssistantMessageCount();
    const stopButtonVisible = await this.stopButton.isVisible().catch(() => false);

    const assistantAlreadyUpdated =
      (currentAssistantCount > baselineCount &&
        currentAssistantContent.length > 0) ||
      (currentAssistantContent.length > 0 &&
        currentAssistantContent !== baselineContent);

    if (
      !hasExplicitAssistantBaseline &&
      currentAssistantContent.length > 0 &&
      !stopButtonVisible
    ) {
      await this.waitForInputInteractive(timeout);
      return;
    }

    if (assistantAlreadyUpdated && !stopButtonVisible) {
      await this.waitForInputInteractive(timeout);
      return;
    }

    await this.waitForAssistantMessageUpdate({
      previousCount: baselineCount,
      previousContent: baselineContent,
      timeout,
    });
    await expect(this.stopButton).not.toBeVisible({ timeout });
    await this.waitForInputInteractive(timeout);
  }

  async isVoteComplete() {
    const response =
      this.pendingVoteResponse ??
      this.page.waitForResponse(
        (currentResponse) =>
          currentResponse.url().includes("/api/vote") &&
          currentResponse.request().method() === "PATCH"
      );

    const settledResponse = await response;
    this.pendingVoteResponse = null;

    await settledResponse.finished();
    expect(settledResponse.ok()).toBe(true);
  }

  async hasChatIdInUrl() {
    await expect(this.page).toHaveURL(CHAT_ID_REGEX);
  }

  async sendUserMessageFromSuggestion() {
    await this.waitForChatInputReady();
    this.armChatResponseWaiter();
    await this.page
      .getByRole("button", { name: "What is Model Context Protocol" })
      .click();
  }

  async isElementVisible(elementId: string) {
    await expect(this.page.getByTestId(elementId)).toBeVisible();
  }

  async isElementNotVisible(elementId: string) {
    await expect(this.page.getByTestId(elementId)).not.toBeVisible();
  }

  async getSelectedModel() {
    await this.waitForChatShellReady();
    const modelId = await this.modelSelector.innerText();
    return modelId.trim();
  }

  private async getVisibilitySelector() {
    const visibilitySelector = this.page.getByTestId("visibility-selector").first();

    const isVisible = await visibilitySelector.isVisible().catch(() => false);
    if (!isVisible) {
      await this.openSideBar();
    }

    await expect(visibilitySelector).toBeVisible();
    return visibilitySelector;
  }

  async chooseModelFromSelector(chatModelId: string) {
    const chatModel = chatModels.find(
      (currentChatModel) => currentChatModel.id === chatModelId
    );

    if (!chatModel) {
      throw new Error(`Model with id ${chatModelId} not found`);
    }

    await this.waitForChatShellReady();
    await expect(this.modelSelector).toBeEnabled();
    await this.modelSelector.click();
    await expect(
      this.page.getByTestId(`model-selector-item-${chatModelId}`)
    ).toBeVisible();
    await this.page.getByTestId(`model-selector-item-${chatModelId}`).click();
    expect(await this.getSelectedModel()).toBe(chatModel.name);
  }

  async getSelectedVisibility() {
    const visibilitySelector = await this.getVisibilitySelector();
    const visibilityId = await visibilitySelector.innerText();
    return visibilityId.trim().toLowerCase();
  }

  async chooseVisibilityFromSelector(chatVisibility: "public" | "private") {
    const visibilitySelector = await this.getVisibilitySelector();
    await visibilitySelector.click({ force: true });
    const visibilityOption = this.page
      .getByTestId(`visibility-selector-item-${chatVisibility}`)
      .first();
    await expect(visibilityOption).toBeVisible();
    await visibilityOption.click();
    expect(await this.getSelectedVisibility()).toContain(chatVisibility);
  }

  async getRecentAssistantMessage() {
    await this.waitForLatestAssistantContent();
    const latestMessage = await this.findLatestAssistantMessageWithContent();
    const chatPage = this;

    if (!latestMessage) {
      throw new Error("Latest assistant message has no visible content");
    }

    const { element: lastMessageElement, content } = latestMessage;

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
      async upvote() {
        await lastMessageElement.hover();
        chatPage.armVoteResponseWaiter();
        await lastMessageElement.getByTestId("message-upvote").click();
      },
      async downvote() {
        await lastMessageElement.hover();
        chatPage.armVoteResponseWaiter();
        await lastMessageElement.getByTestId("message-downvote").click();
      },
    };
  }

  async getRecentUserMessage() {
    await expect(this.scrollContainer.getByTestId("message-user").last()).toBeVisible();
    const messageElements = await this.scrollContainer
      .getByTestId("message-user")
      .all();
    const lastMessageElement = messageElements.at(-1);

    if (!lastMessageElement) {
      throw new Error("No user message found");
    }

    const content = await lastMessageElement
      .getByTestId("message-content")
      .innerText();

    const attachmentsContainer = lastMessageElement.getByTestId("message-attachments");
    const attachmentItems = attachmentsContainer.getByTestId(
      "input-attachment-preview"
    );
    let attachmentsCount = await attachmentItems.count().catch(() => 0);

    if (attachmentsCount === 0) {
      await expect
        .poll(
          async () =>
            lastMessageElement
              .getByTestId("message-attachments")
              .getByTestId("input-attachment-preview")
              .count()
              .catch(() => 0),
          {
            timeout: 5_000,
            message: "Expected the latest user message to render its attachments",
          }
        )
        .toBeGreaterThan(0)
        .catch(() => {});

      attachmentsCount = await attachmentItems.count().catch(() => 0);
    }

    const attachments = attachmentsCount > 0 ? await attachmentItems.all() : [];

    const page = this.page;
    const chatPage = this;

    return {
      element: lastMessageElement,
      content,
      attachments,
      async edit(newMessage: string) {
        await lastMessageElement.hover();
        await lastMessageElement.getByTestId("message-edit-button").click();
        await page.getByTestId("message-editor").fill(newMessage);
        chatPage.armChatResponseWaiter();
        await page.getByTestId("message-editor-send-button").click();
        await expect(
          page.getByTestId("message-editor-send-button")
        ).not.toBeVisible();
      },
    };
  }

  async expectToastToContain(text: string) {
    await expect(this.page.getByTestId("toast")).toContainText(text);
  }

  async openSideBar() {
    const sidebarToggleButton = this.page.getByTestId("sidebar-toggle-button");
    await sidebarToggleButton.click({ force: true });
  }

  isScrolledToBottom(): Promise<boolean> {
    return this.scrollContainer.evaluate(
      (el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 24
    );
  }

  async waitForScrollToBottom(timeout = 10_000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await this.isScrolledToBottom()) {
        return;
      }
      await this.page.waitForTimeout(100);
    }

    throw new Error(`Timed out waiting for scroll bottom after ${timeout}ms`);
  }

  async sendMultipleMessages(
    count: number,
    makeMessage: (i: number) => string
  ) {
    for (let i = 0; i < count; i++) {
      await this.sendUserMessage(makeMessage(i));
      await this.isGenerationComplete();
    }
  }

  async scrollToTop(): Promise<void> {
    await this.scrollContainer.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(this.scrollToBottomButton).toBeVisible();
  }
}
