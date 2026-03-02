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
    expect(assistantMessage.content).toBe("It's just blue duh!");

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

  test("updates the response after editing a message", async () => {
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const userMessage = await chatPage.getRecentUserMessage();
    await userMessage.edit("Why is grass green?");

    await chatPage.isGenerationComplete();

    const updatedAssistantMessage = await chatPage.getRecentAssistantMessage();
    expect(updatedAssistantMessage.content).toBe("It's just green duh!");
  });
});
