import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentChatMessage } from "@/lib/types";

type StreamEvent = {
  type: string;
  payload: {
    id: string;
    name: string;
    content: string;
  };
};

type MinimalAgentRegistry = {
  getAll: () => Array<{ id: string }>;
};

type MinimalMainAgent = {
  run: (inputMessages: AgentChatMessage[]) => Promise<Response>;
};

const UNUSED_AGENT_MODULES = [
  "@/lib/agents/githubAgent/githubAgent",
  "@/lib/agents/codebaseAgent/codebaseAgent",
  "@/lib/agents/huggingFaceAgent/huggingFaceAgent",
  "@/lib/agents/googleWorkspaceAgent/googleWorkspaceAgent",
  "@/lib/agents/searchAgent/searchAgent",
  "@/lib/agents/codingAgent/codingAgent",
  "@/lib/agents/dataAnalystAgent/dataAnalystAgent",
  "@/lib/agents/visionAgent/visionAgent",
];

function makeToolCall(
  name: string,
  args: Record<string, unknown>,
  id: string
) {
  return {
    id,
    name,
    args,
    type: "tool_call" as const,
  };
}

function getMessageContent(message: Pick<BaseMessage, "content">): string {
  return typeof message.content === "string"
    ? message.content
    : JSON.stringify(message.content);
}

function hasToolResult(messages: BaseMessage[], toolName: string): boolean {
  return messages.some((message) => {
    const typedMessage = message as BaseMessage & { name?: string };
    return (
      typedMessage._getType() === "tool" && typedMessage.name === toolName
    );
  });
}

function createBoundLLM(tools: DynamicStructuredTool[]) {
  const toolNames = tools.map((tool) => tool.name);

  return {
    invoke: vi.fn(async (messages: BaseMessage[]) => {
      if (toolNames.includes("delegate_to_frontend")) {
        const sawFrontendCompletion = messages.some((message) =>
          getMessageContent(message).includes(
            "Switched the application to dark mode."
          )
        );

        if (sawFrontendCompletion) {
          return new AIMessage({
            content: "The application has been switched to dark mode.",
          });
        }

        return new AIMessage({
          content: "",
          tool_calls: [
            makeToolCall(
              "delegate_to_frontend",
              { task: "Switch the application to dark mode." },
              "delegate-front-1"
            ),
          ],
        });
      }

      if (toolNames.includes("set_theme")) {
        if (hasToolResult(messages, "set_theme")) {
          return new AIMessage({
            content: "Switched the application to dark mode.",
          });
        }

        return new AIMessage({
          content: "",
          tool_calls: [
            makeToolCall("set_theme", { theme: "dark" }, "set-theme-1"),
          ],
        });
      }

      return new AIMessage({
        content: "No tool routing was configured for this fake LLM.",
      });
    }),
  };
}

function installMainAgentIntegrationMocks() {
  vi.doMock("@/lib/agents/llmFactory", () => ({
    createLLM: vi.fn(() => ({
      bindTools: vi.fn((tools: DynamicStructuredTool[]) => createBoundLLM(tools)),
    })),
  }));

  for (const modulePath of UNUSED_AGENT_MODULES) {
    vi.doMock(modulePath, () => ({}));
  }
}

async function drainResponse(response: Response): Promise<StreamEvent[]> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Expected response stream body");
  }

  const decoder = new TextDecoder();
  let raw = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    raw += decoder.decode(value, { stream: true });
  }

  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as StreamEvent);
}

function decodePayloadContent(event: StreamEvent): unknown {
  try {
    return JSON.parse(event.payload.content);
  } catch {
    return event.payload.content;
  }
}

describe("MainAgent orchestration integration", () => {
  let mainAgent: MinimalMainAgent;
  let agentRegistry: MinimalAgentRegistry;

  beforeEach(async () => {
    vi.resetModules();
    installMainAgentIntegrationMocks();

    const registryModule = await import("@/lib/agents/agentRegistry");
    const mainAgentModule = await import("@/lib/agents/mainAgent/mainAgent");

    agentRegistry = registryModule.agentRegistry as MinimalAgentRegistry;
    mainAgent = mainAgentModule.mainAgent as unknown as MinimalMainAgent;
  });

  it("runs main-agent -> frontend-agent -> set_theme tool end-to-end", async () => {
    expect(agentRegistry.getAll().map((agent) => agent.id)).toEqual([
      "frontend-agent",
    ]);

    const response = await mainAgent.run([
      {
        role: "user",
        content: "Please switch the application to dark mode.",
      },
    ]);

    const events = await drainResponse(response);

    expect(events.find((event) => event.type === "agent_error")).toBeUndefined();

    const mainStartedIndex = events.findIndex(
      (event) =>
        event.type === "agent_started" && event.payload.id === "main-agent"
    );
    const frontendStartedIndex = events.findIndex(
      (event) =>
        event.type === "agent_started" &&
        event.payload.id === "frontend-agent"
    );
    const toolStartedIndex = events.findIndex(
      (event) =>
        event.type === "tool_started" && event.payload.name === "set_theme"
    );
    const toolEndedIndex = events.findIndex(
      (event) =>
        event.type === "tool_ended" && event.payload.name === "set_theme"
    );
    const frontendEndedIndex = events.findIndex(
      (event) =>
        event.type === "agent_ended" && event.payload.id === "frontend-agent"
    );
    const mainEndedIndex = events.findLastIndex(
      (event) =>
        event.type === "agent_ended" && event.payload.id === "main-agent"
    );

    expect(mainStartedIndex).toBeGreaterThanOrEqual(0);
    expect(frontendStartedIndex).toBeGreaterThan(mainStartedIndex);
    expect(toolStartedIndex).toBeGreaterThan(frontendStartedIndex);
    expect(toolEndedIndex).toBeGreaterThan(toolStartedIndex);
    expect(frontendEndedIndex).toBeGreaterThan(toolEndedIndex);
    expect(mainEndedIndex).toBeGreaterThan(frontendEndedIndex);

    const frontendStartedEvent = events[frontendStartedIndex];
    expect(frontendStartedEvent.payload.content).toContain("[Frontend Task]");
    expect(frontendStartedEvent.payload.content).toContain(
      "Switch the application to dark mode."
    );

    const toolEndedEvent = events[toolEndedIndex];
    const toolOutput = decodePayloadContent(toolEndedEvent);

    expect(typeof toolOutput).toBe("string");
    expect(toolOutput).toContain("<UI_ACTION>");
    expect(toolOutput).toContain("\"set_theme\"");
    expect(toolOutput).toContain("\"dark\"");

    const frontendEndedEvent = events[frontendEndedIndex];
    const frontendOutput = decodePayloadContent(frontendEndedEvent);

    expect(typeof frontendOutput).toBe("string");
    expect(frontendOutput).toContain("dark mode");
  });
});
