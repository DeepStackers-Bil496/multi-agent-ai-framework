import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { afterEach, describe, expect, it, vi } from "vitest";
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

type DelegationScenario = {
  activeAgentModule: string;
  expectedAgentId: string;
  delegationTool: string;
  taskPrefix: string;
  task: string;
  subAgentTool: string;
  subAgentToolArgs: Record<string, unknown>;
  subAgentCompletion: string;
  mainCompletion: string;
  userMessage: string;
  installDependencyMocks?: () => void;
  assertToolOutput: (toolOutput: string) => void;
};

const ALL_AGENT_MODULES = [
  "@/lib/agents/githubAgent/githubAgent",
  "@/lib/agents/codebaseAgent/codebaseAgent",
  "@/lib/agents/frontendAgent/frontendAgent",
  "@/lib/agents/huggingFaceAgent/huggingFaceAgent",
  "@/lib/agents/googleWorkspaceAgent/googleWorkspaceAgent",
  "@/lib/agents/searchAgent/searchAgent",
  "@/lib/agents/codingAgent/codingAgent",
  "@/lib/agents/dataAnalystAgent/dataAnalystAgent",
  "@/lib/agents/visionAgent/visionAgent",
];

const FRONTEND_SCENARIO: DelegationScenario = {
  activeAgentModule: "@/lib/agents/frontendAgent/frontendAgent",
  expectedAgentId: "frontend-agent",
  delegationTool: "delegate_to_frontend",
  taskPrefix: "[Frontend Task]",
  task: "Switch the application to dark mode.",
  subAgentTool: "set_theme",
  subAgentToolArgs: { theme: "dark" },
  subAgentCompletion: "Switched the application to dark mode.",
  mainCompletion: "The application has been switched to dark mode.",
  userMessage: "Please switch the application to dark mode.",
  assertToolOutput: (toolOutput) => {
    expect(toolOutput).toContain("<UI_ACTION>");
    expect(toolOutput).toContain("\"set_theme\"");
    expect(toolOutput).toContain("\"dark\"");
  },
};

const SEARCH_SCENARIO: DelegationScenario = {
  activeAgentModule: "@/lib/agents/searchAgent/searchAgent",
  expectedAgentId: "search-agent",
  delegationTool: "delegate_to_search",
  taskPrefix: "[Search Task]",
  task: "Find recent LangGraph multi-agent orchestration resources.",
  subAgentTool: "web_search",
  subAgentToolArgs: {
    query: "LangGraph multi-agent orchestration",
    numResults: 3,
  },
  subAgentCompletion:
    "I found recent web search results about LangGraph multi-agent orchestration.",
  mainCompletion:
    "Here are recent LangGraph multi-agent orchestration resources I found.",
  userMessage:
    "Search the web for recent LangGraph multi-agent orchestration resources.",
  installDependencyMocks: () => {
    vi.doMock("duck-duck-scrape", () => ({
      search: vi.fn().mockResolvedValue({
        results: [
          {
            title: "LangGraph Multi-Agent Guide",
            url: "https://example.com/langgraph-guide",
            description:
              "Guide to building multi-agent workflows with LangGraph.",
          },
          {
            title: "Advanced LangGraph Orchestration",
            url: "https://example.com/langgraph-orchestration",
            description:
              "Patterns for multi-agent routing and orchestration.",
          },
        ],
        noResults: false,
      }),
      searchNews: vi.fn().mockResolvedValue({ results: [] }),
      SafeSearchType: {
        STRICT: "STRICT",
        MODERATE: "MODERATE",
        OFF: "OFF",
      },
    }));
  },
  assertToolOutput: (toolOutput) => {
    expect(toolOutput).toContain("LangGraph Multi-Agent Guide");
    expect(toolOutput).toContain("https://example.com/langgraph-guide");
  },
};

const GITHUB_SCENARIO: DelegationScenario = {
  activeAgentModule: "@/lib/agents/githubAgent/githubAgent",
  expectedAgentId: "github-agent",
  delegationTool: "delegate_to_github",
  taskPrefix: "[GitHub Task]",
  task: "List recent commits for openai/openai-node.",
  subAgentTool: "list_commits",
  subAgentToolArgs: {
    owner: "openai",
    repo: "openai-node",
    perPage: 2,
  },
  subAgentCompletion:
    "I retrieved the recent commits for openai/openai-node.",
  mainCompletion: "I found the recent commits for openai/openai-node.",
  userMessage: "Check the recent commits for openai/openai-node on GitHub.",
  installDependencyMocks: () => {
    process.env.GITHUB_PAT = "ghp_test_token";

    vi.doMock("@modelcontextprotocol/sdk/client/index.js", () => ({
      Client: vi.fn().mockImplementation(function () {
        return {
          connect: vi.fn().mockResolvedValue(undefined),
          callTool: vi.fn().mockResolvedValue({
            content: [
              {
                type: "text",
                text: JSON.stringify([
                  {
                    sha: "abc123",
                    commit: { message: "Initial commit" },
                  },
                  {
                    sha: "def456",
                    commit: { message: "Add orchestration improvements" },
                  },
                ]),
              },
            ],
          }),
        };
      }),
    }));

    vi.doMock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
      StreamableHTTPClientTransport: vi
        .fn()
        .mockImplementation(function () {
          return {};
        }),
    }));
  },
  assertToolOutput: (toolOutput) => {
    expect(toolOutput).toContain("**list_commits Result:**");
    expect(toolOutput).toContain("abc123");
    expect(toolOutput).toContain("Initial commit");
  },
};

const CODEBASE_SCENARIO: DelegationScenario = {
  activeAgentModule: "@/lib/agents/codebaseAgent/codebaseAgent",
  expectedAgentId: "codebase-agent",
  delegationTool: "delegate_to_codebase",
  taskPrefix: "[Codebase Task]",
  task: "Find where the runtime graph cache version is computed.",
  subAgentTool: "search_codebase",
  subAgentToolArgs: {
    query: "runtime graph cache version",
    filePathPrefix: "lib/agents/",
  },
  subAgentCompletion:
    "I found the relevant codebase snippets for config version caching.",
  mainCompletion: "I found where runtime graph cache version is computed.",
  userMessage:
    "Find in the codebase where the runtime graph cache version is computed.",
  installDependencyMocks: () => {
    vi.doMock("@/lib/agents/codebaseAgent/vectorSearch", () => ({
      searchCodebase: vi.fn().mockResolvedValue([
        {
          filePath: "lib/agents/configResolver.ts",
          chunkType: "function",
          chunkName: "recomputeConfigVersion",
          parentClass: null,
          content:
            "export async function recomputeConfigVersion() { return 'hash'; }",
          startLine: 11,
          endLine: 18,
          distance: 0.05,
        },
      ]),
    }));
  },
  assertToolOutput: (toolOutput) => {
    expect(toolOutput).toContain("lib/agents/configResolver.ts");
    expect(toolOutput).toContain("recomputeConfigVersion");
  },
};

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

function createBoundLLM(
  tools: DynamicStructuredTool[],
  scenario: DelegationScenario
) {
  const toolNames = tools.map((tool) => tool.name);

  return {
    invoke: vi.fn(async (messages: BaseMessage[]) => {
      if (toolNames.includes(scenario.delegationTool)) {
        const sawSubAgentCompletion = messages.some((message) =>
          getMessageContent(message).includes(scenario.subAgentCompletion)
        );

        if (sawSubAgentCompletion) {
          return new AIMessage({
            content: scenario.mainCompletion,
          });
        }

        return new AIMessage({
          content: "",
          tool_calls: [
            makeToolCall(
              scenario.delegationTool,
              { task: scenario.task },
              `delegate-${scenario.expectedAgentId}`
            ),
          ],
        });
      }

      if (toolNames.includes(scenario.subAgentTool)) {
        if (hasToolResult(messages, scenario.subAgentTool)) {
          return new AIMessage({
            content: scenario.subAgentCompletion,
          });
        }

        return new AIMessage({
          content: "",
          tool_calls: [
            makeToolCall(
              scenario.subAgentTool,
              scenario.subAgentToolArgs,
              `${scenario.subAgentTool}-1`
            ),
          ],
        });
      }

      return new AIMessage({
        content: "No tool routing was configured for this fake LLM.",
      });
    }),
  };
}

function installMainAgentIntegrationMocks(scenario: DelegationScenario) {
  scenario.installDependencyMocks?.();

  vi.doMock("@/lib/agents/llmFactory", () => ({
    createLLM: vi.fn(() => ({
      bindTools: vi.fn((tools: DynamicStructuredTool[]) =>
        createBoundLLM(tools, scenario)
      ),
    })),
  }));

  for (const modulePath of ALL_AGENT_MODULES) {
    if (modulePath !== scenario.activeAgentModule) {
      vi.doMock(modulePath, () => ({}));
    }
  }
}

async function loadScenario(scenario: DelegationScenario) {
  vi.resetModules();
  installMainAgentIntegrationMocks(scenario);

  const registryModule = await import("@/lib/agents/agentRegistry");
  const mainAgentModule = await import("@/lib/agents/mainAgent/mainAgent");

  return {
    agentRegistry: registryModule.agentRegistry as MinimalAgentRegistry,
    mainAgent: mainAgentModule.mainAgent as unknown as MinimalMainAgent,
  };
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

async function expectDelegationScenario(scenario: DelegationScenario) {
  const { agentRegistry, mainAgent } = await loadScenario(scenario);

  expect(agentRegistry.getAll().map((agent) => agent.id)).toEqual([
    scenario.expectedAgentId,
  ]);

  const response = await mainAgent.run([
    {
      role: "user",
      content: scenario.userMessage,
    },
  ]);

  const events = await drainResponse(response);

  expect(events.find((event) => event.type === "agent_error")).toBeUndefined();

  const mainStartedIndex = events.findIndex(
    (event) => event.type === "agent_started" && event.payload.id === "main-agent"
  );
  const subAgentStartedIndex = events.findIndex(
    (event) =>
      event.type === "agent_started" &&
      event.payload.id === scenario.expectedAgentId
  );
  const toolStartedIndex = events.findIndex(
    (event) =>
      event.type === "tool_started" &&
      event.payload.name === scenario.subAgentTool
  );
  const toolEndedIndex = events.findIndex(
    (event) =>
      event.type === "tool_ended" &&
      event.payload.name === scenario.subAgentTool
  );
  const subAgentEndedIndex = events.findIndex(
    (event) =>
      event.type === "agent_ended" &&
      event.payload.id === scenario.expectedAgentId
  );
  const mainEndedIndex = events.findLastIndex(
    (event) => event.type === "agent_ended" && event.payload.id === "main-agent"
  );

  expect(mainStartedIndex).toBeGreaterThanOrEqual(0);
  expect(subAgentStartedIndex).toBeGreaterThan(mainStartedIndex);
  expect(toolStartedIndex).toBeGreaterThan(subAgentStartedIndex);
  expect(toolEndedIndex).toBeGreaterThan(toolStartedIndex);
  expect(subAgentEndedIndex).toBeGreaterThan(toolEndedIndex);
  expect(mainEndedIndex).toBeGreaterThan(subAgentEndedIndex);

  const subAgentStartedEvent = events[subAgentStartedIndex];
  expect(subAgentStartedEvent?.payload.content).toContain(scenario.taskPrefix);
  expect(subAgentStartedEvent?.payload.content).toContain(scenario.task);

  const toolEndedEvent = events[toolEndedIndex];
  const toolOutput = decodePayloadContent(toolEndedEvent);
  expect(typeof toolOutput).toBe("string");
  scenario.assertToolOutput(toolOutput as string);

  const subAgentEndedEvent = events[subAgentEndedIndex];
  const subAgentOutput = decodePayloadContent(subAgentEndedEvent);
  expect(typeof subAgentOutput).toBe("string");
  expect(subAgentOutput).toContain(scenario.subAgentCompletion);

  const mainEndedEvent = events[mainEndedIndex];
  const mainOutput = decodePayloadContent(mainEndedEvent);
  expect(typeof mainOutput).toBe("string");
  expect(mainOutput).toContain(scenario.mainCompletion);
}

describe("MainAgent orchestration integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GITHUB_PAT;
  });

  it("runs main-agent -> frontend-agent -> set_theme tool end-to-end", async () => {
    await expectDelegationScenario(FRONTEND_SCENARIO);
  });

  it("runs main-agent -> search-agent -> web_search tool end-to-end", async () => {
    await expectDelegationScenario(SEARCH_SCENARIO);
  });

  it("runs main-agent -> github-agent -> list_commits tool end-to-end", async () => {
    await expectDelegationScenario(GITHUB_SCENARIO);
  });

  it("runs main-agent -> codebase-agent -> search_codebase tool end-to-end", async () => {
    await expectDelegationScenario(CODEBASE_SCENARIO);
  });
});
