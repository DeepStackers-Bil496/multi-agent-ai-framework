import { expect, test } from "../fixtures";
import { ChatPage } from "../pages/chat";

test.describe("Agent model selector", () => {
  test("user can switch to main-agent and receive a response", async ({
    adaContext,
  }) => {
    const chatPage = new ChatPage(adaContext.page);
    await chatPage.createNewChat();
    await chatPage.chooseModelFromSelector("main-agent");
    await expect(chatPage.getSelectedModel()).resolves.toBe("Main Agent");

    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content.toLowerCase()).toContain("blue");
  });

  test("selected model label is reflected in the UI after switching", async ({
    adaContext,
  }) => {
    const chatPage = new ChatPage(adaContext.page);
    await chatPage.createNewChat();
    await chatPage.chooseModelFromSelector("main-agent");

    const selected = await chatPage.getSelectedModel();
    expect(selected).toBe("Main Agent");
  });
});

test.describe("Chat persistence", () => {
  test("conversation survives a full page reload", async ({ adaContext }) => {
    const chatPage = new ChatPage(adaContext.page);
    await chatPage.createNewChat();
    await chatPage.chooseModelFromSelector("main-agent");

    await chatPage.sendUserMessage("Why is grass green?");
    await chatPage.isGenerationComplete();

    await adaContext.page.reload();
    await adaContext.page.waitForLoadState("networkidle");

    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.content).toContain("Why is grass green?");

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content.length).toBeGreaterThan(0);
  });

  test("creating a new chat navigates to a clean empty state", async ({
    adaContext,
  }) => {
    const chatPage = new ChatPage(adaContext.page);

    await chatPage.createNewChat();
    await chatPage.chooseModelFromSelector("main-agent");
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    await chatPage.createNewChat();

    const input = adaContext.page.getByTestId("multimodal-input");
    await expect(input).toBeEmpty();
  });

  test("new chat appears in sidebar history after first message", async ({
    adaContext,
  }) => {
    const chatPage = new ChatPage(adaContext.page);
    await chatPage.createNewChat();
    await chatPage.chooseModelFromSelector("main-agent");
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    // force: true bypasses the Next.js dev overlay portal intercept
    const sidebarToggle = adaContext.page.getByTestId("sidebar-toggle-button");
    await sidebarToggle.click({ force: true });

    const chatHistory = adaContext.page.getByTestId("chat-history");
    await expect(chatHistory).toBeVisible();

    const chatItems = chatHistory.locator("[data-testid^='chat-item-']");
    await expect(chatItems.first()).toBeVisible();
  });

  test("URL contains a chat ID after the first message is sent", async ({
    adaContext,
  }) => {
    const chatPage = new ChatPage(adaContext.page);
    await chatPage.createNewChat();
    await chatPage.chooseModelFromSelector("main-agent");
    await chatPage.sendUserMessage("Why is the sky blue?");
    await chatPage.isGenerationComplete();

    await chatPage.hasChatIdInUrl();
  });
});

test.describe("User isolation", () => {
  test("Ada and Babbage have completely separate chat histories", async ({
    adaContext,
    babbageContext,
  }) => {
    const adaChat = new ChatPage(adaContext.page);
    await adaChat.createNewChat();
    await adaChat.chooseModelFromSelector("main-agent");
    await adaChat.sendUserMessage("Ada's private note UNIQADA99");
    await adaChat.isGenerationComplete();

    const babbageChat = new ChatPage(babbageContext.page);
    await babbageChat.createNewChat();
    await babbageChat.chooseModelFromSelector("main-agent");
    await babbageChat.sendUserMessage("Babbage's private note UNIQBAB88");
    await babbageChat.isGenerationComplete();

    const adaUserMsg = await adaChat.getRecentUserMessage();
    expect(adaUserMsg.content).not.toContain("UNIQBAB88");

    const babbageUserMsg = await babbageChat.getRecentUserMessage();
    expect(babbageUserMsg.content).not.toContain("UNIQADA99");
  });

  test("navigating to another user's private chat URL is denied or blank", async ({
    adaContext,
    babbageContext,
  }) => {
    const adaChat = new ChatPage(adaContext.page);
    await adaChat.createNewChat();
    await adaChat.chooseModelFromSelector("main-agent");
    await adaChat.chooseVisibilityFromSelector("private");
    await adaChat.sendUserMessage("Top secret content TOPSECRET123");
    await adaChat.isGenerationComplete();

    const adaChatUrl = adaContext.page.url();
    expect(adaChatUrl).toMatch(/\/chat\//);

    const response = await babbageContext.page.goto(adaChatUrl);
    await babbageContext.page.waitForLoadState("networkidle");

    const currentUrl = babbageContext.page.url();
    const pageContent = await babbageContext.page.textContent("body");
    const statusCode = response?.status() ?? null;

    const wasDenied = statusCode === 404 || currentUrl !== adaChatUrl;
    const secretNotVisible = !pageContent?.includes("TOPSECRET123");

    expect(wasDenied || secretNotVisible).toBe(true);
  });
});

test.describe("Main-agent mock response correctness", () => {
  const PROMPTS: Array<{ input: string; fragment: string }> = [
    { input: "Why is the sky blue?", fragment: "blue" },
    { input: "Why is grass green?", fragment: "green" },
    { input: "What's the weather in sf?", fragment: "San Francisco" },
    {
      input: "What is Model Context Protocol?",
      fragment: "Model Context Protocol",
    },
  ];

  for (const { input, fragment } of PROMPTS) {
    test(`"${input}" → response contains "${fragment}"`, async ({
      adaContext,
    }) => {
      const chatPage = new ChatPage(adaContext.page);
      await chatPage.createNewChat();
      await chatPage.chooseModelFromSelector("main-agent");

      await chatPage.sendUserMessage(input);
      await chatPage.isGenerationComplete();

      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content.toLowerCase()).toContain(
        fragment.toLowerCase()
      );
    });
  }
});
