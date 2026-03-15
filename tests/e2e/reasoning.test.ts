import { expect, test } from "../fixtures";
import { ChatPage } from "../pages/chat";

test.describe("chat activity with execution flow", () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ curieContext }) => {
    chatPage = new ChatPage(curieContext.page);
    await chatPage.createNewChat();
  });

  test("shows an execution summary for streamed agent responses", async ({
    curieContext,
  }) => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    // Mock: "It's just blue duh!" — real Gemini: mentions "blue"
    expect(assistantMessage.content.toLowerCase()).toContain("blue");

    await expect(
      curieContext.page.getByTestId("thinking-flow-trigger").last()
    ).toBeVisible();
  });

  test("can expand execution flow details", async ({ curieContext }) => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    await curieContext.page.getByTestId("thinking-flow-trigger").last().click();

    await expect(
      curieContext.page
        .getByTestId("execution-step-name")
        .filter({ hasText: "Main Agent" })
        .last()
    ).toBeVisible();
  });

  test("updates the response after editing a message", async ({
    curieContext,
  }) => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const firstAssistant = await chatPage.getRecentAssistantMessage();
    expect(firstAssistant.content.toLowerCase()).toContain("blue");

    const userMessage = await chatPage.getRecentUserMessage();
    await userMessage.edit("Why is grass green?");

    // Wait for the second /api/chat response after the edit
    await chatPage.isGenerationComplete();

    const updatedAssistantMessage = await chatPage.getRecentAssistantMessage();
    // Mock: "It's just green duh!" — real Gemini: mentions "green"
    expect(updatedAssistantMessage.content.toLowerCase()).toContain("green");
  });
});
