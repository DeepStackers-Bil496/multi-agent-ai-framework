import { expect, test } from "../fixtures";
import { ChatPage } from "../pages/chat";

test.describe("Chat activity", () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test("Send a user message and receive response", async () => {
    await chatPage.sendUserMessage("Why is grass green?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    // Mock response contains "green"; real Gemini also mentions green
    expect(assistantMessage.content.toLowerCase()).toContain("green");
  });

  test("Redirect to /chat/:id after submitting message", async () => {
    await chatPage.sendUserMessage("Why is grass green?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content.toLowerCase()).toContain("green");
    await chatPage.hasChatIdInUrl();
  });

  test("Send a user message from suggestion", async () => {
    await chatPage.sendUserMessageFromSuggestion();
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    // Both mock and real responses mention "Model Context Protocol"
    expect(assistantMessage.content).toContain("Model Context Protocol");
  });

  test("Toggle between send/stop button based on activity", async () => {
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.sendButton).toBeDisabled();

    await chatPage.sendUserMessage("Why is grass green?");

    await expect(chatPage.sendButton).not.toBeVisible();
    await expect(chatPage.stopButton).toBeVisible();

    await chatPage.isGenerationComplete();

    await expect(chatPage.stopButton).not.toBeVisible();
    await expect(chatPage.sendButton).toBeVisible();
  });

  test("Stop generation during submission", async () => {
    await chatPage.sendUserMessage("Why is grass green?");
    await expect(chatPage.stopButton).toBeVisible();
    await chatPage.stopButton.click();
    await expect(chatPage.sendButton).toBeVisible();
  });

  test("Edit user message and resubmit", async () => {
    await chatPage.sendUserMessage("Why is grass green?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content.toLowerCase()).toContain("green");

    const userMessage = await chatPage.getRecentUserMessage();
    await userMessage.edit("Why is the sky blue?");

    await chatPage.isGenerationComplete({
      previousAssistantContent: assistantMessage.content,
    });

    const updatedAssistantMessage = await chatPage.getRecentAssistantMessage();
    expect(updatedAssistantMessage.content.toLowerCase()).toContain("blue");
  });

  test("Hide suggested actions after sending message", async () => {
    await chatPage.isElementVisible("suggested-actions");
    await chatPage.sendUserMessageFromSuggestion();
    await chatPage.isElementNotVisible("suggested-actions");
  });

  test("Upload file and send image attachment with message", async () => {
    await chatPage.addImageAttachment();

    await chatPage.isElementVisible("attachments-preview");
    await chatPage.isElementVisible("input-attachment-loader");
    await chatPage.isElementNotVisible("input-attachment-loader");

    await chatPage.sendUserMessage("Who painted this?");

    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.attachments).toHaveLength(1);

    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    // Mock returns "This painting is by Monet!"; real API may differ
    expect(assistantMessage.content.length).toBeGreaterThan(0);
  });

  test("Call weather tool", async () => {
    await chatPage.sendUserMessage("What's the weather in sf?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    // Both mock and real responses mention San Francisco
    expect(assistantMessage.content).toContain("San Francisco");
  });

  test("Upvote message", async () => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await assistantMessage.upvote();
    await chatPage.isVoteComplete();
  });

  test("Downvote message", async () => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await assistantMessage.downvote();
    await chatPage.isVoteComplete();
  });

  test("Update vote", async () => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    await assistantMessage.upvote();
    await chatPage.isVoteComplete();

    await assistantMessage.downvote();
    await chatPage.isVoteComplete();
  });

  test("Create message from url query", async ({ page }) => {
    await page.goto("/?query=Why is the sky blue?");

    await expect(page.getByTestId("message-user").last()).toContainText(
      "Why is the sky blue?"
    );
    await chatPage.isGenerationComplete();

    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.content).toBe("Why is the sky blue?");

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content.toLowerCase()).toContain("blue");
  });

  test("auto-scrolls to bottom after submitting new messages", async () => {
    await chatPage.sendMultipleMessages(20, (i) => `filling message #${i}`);
    await chatPage.waitForScrollToBottom();
  });

  test("scroll button appears when user scrolls up, hides on click", async () => {
    await chatPage.sendMultipleMessages(20, (i) => `filling message #${i}`);
    await chatPage.waitForScrollToBottom();
    await expect(chatPage.scrollToBottomButton).not.toBeVisible();

    await chatPage.scrollToTop();
    await expect(chatPage.scrollToBottomButton).toBeVisible();

    await chatPage.scrollToBottomButton.click();
    await chatPage.waitForScrollToBottom();
    await expect(chatPage.scrollToBottomButton).not.toBeVisible();
  });
});
