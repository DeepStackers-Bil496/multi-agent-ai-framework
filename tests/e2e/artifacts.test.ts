import { expect, test } from "../fixtures";
import { ArtifactPage } from "../pages/artifact";
import { ChatPage } from "../pages/chat";

test.describe("Artifacts activity", () => {
  let chatPage: ChatPage;
  let artifactPage: ArtifactPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    artifactPage = new ArtifactPage(page);

    await chatPage.createNewChat();
  });

  test("Create a text artifact", async () => {
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      "Help me write an essay about Silicon Valley"
    );
    await artifactPage.isGenerationComplete();

    await expect(artifactPage.artifact).toBeVisible();

    await chatPage.hasChatIdInUrl();
  });

  test("Toggle artifact visibility", async () => {
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      "Help me write an essay about Silicon Valley"
    );
    await artifactPage.isGenerationComplete();

    await expect(artifactPage.artifact).toBeVisible();

    await artifactPage.closeArtifact();
    await chatPage.isElementNotVisible("artifact");
  });

  test("Send follow up message after generation", async () => {
    await chatPage.createNewChat();

    await chatPage.sendUserMessage(
      "Help me write an essay about Silicon Valley"
    );
    await artifactPage.isGenerationComplete();

    await expect(artifactPage.artifact).toBeVisible();
    const initialAssistantMessage = await artifactPage.getRecentAssistantMessage();

    await artifactPage.sendUserMessage("Thanks!");
    await artifactPage.isGenerationComplete();

    const secondAssistantMessage = await artifactPage.getRecentAssistantMessage({
      previousContent: initialAssistantMessage.content,
    });
    expect(secondAssistantMessage.content).toBe("You're welcome!");
  });
});
