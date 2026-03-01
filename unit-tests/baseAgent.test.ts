import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/agents/baseAgent.ts
 *
 * Mocks llmFactory directly so no API key validation or real LLM calls happen.
 * The factory is the first thing BaseAgent calls in its constructor, so mocking
 * the individual LangChain packages is too late — the key check fires first.
 */

const mockLLM = {
  bindTools: vi.fn().mockReturnThis(),
  invoke: vi.fn(),
};

vi.mock("@/lib/agents/llmFactory", () => ({
  createLLM: vi.fn().mockReturnValue(mockLLM),
}));

vi.mock("@langchain/langgraph", () => ({
  StateGraph: vi.fn().mockImplementation(function () {
    const compiled = {
      streamEvents: vi.fn().mockReturnValue(
        (async function* () {
          yield {
            event: "on_chat_model_stream",
            data: { chunk: { content: "Hello" } },
            metadata: { langgraph_node: "agent" },
          };
        })()
      ),
    };
    const graph = {
      addNode: vi.fn(),
      addEdge: vi.fn(),
      addConditionalEdges: vi.fn(),
      compile: vi.fn().mockReturnValue(compiled),
    };
    graph.addNode.mockReturnValue(graph);
    graph.addEdge.mockReturnValue(graph);
    graph.addConditionalEdges.mockReturnValue(graph);
    return graph;
  }),
  MessagesAnnotation: { spec: {} },
  START: "__start__",
  END: "__end__",
}));

vi.mock("@langchain/langgraph/prebuilt", () => ({
  ToolNode: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

const googleConfig = {
  user_metadata: {
    id: "test-agent",
    name: "Test Agent",
    short_description: "A test agent",
    long_description: "Used for testing only",
    icon: null,
    suggestedActions: [],
  },
  implementation_metadata: {
    type: "api" as const,
    provider: "google" as const,
    modelID: "gemini-1.5-flash",
    systemInstruction: "You are a test assistant.",
  },
};

describe("BaseAgent", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let BaseAgent: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("@/lib/agents/llmFactory", () => ({
      createLLM: vi.fn().mockReturnValue(mockLLM),
    }));
    vi.mock("@langchain/langgraph", () => ({
      StateGraph: vi.fn().mockImplementation(function () {
        const compiled = {
          streamEvents: vi.fn().mockReturnValue(
            (async function* () {
              yield {
                event: "on_chat_model_stream",
                data: { chunk: { content: "Hello" } },
                metadata: { langgraph_node: "agent" },
              };
            })()
          ),
        };
        const graph = {
          addNode: vi.fn(),
          addEdge: vi.fn(),
          addConditionalEdges: vi.fn(),
          compile: vi.fn().mockReturnValue(compiled),
        };
        graph.addNode.mockReturnValue(graph);
        graph.addEdge.mockReturnValue(graph);
        graph.addConditionalEdges.mockReturnValue(graph);
        return graph;
      }),
      MessagesAnnotation: { spec: {} },
      START: "__start__",
      END: "__end__",
    }));
    vi.mock("@langchain/langgraph/prebuilt", () => ({
      ToolNode: vi.fn().mockImplementation(function () {
        return {};
      }),
    }));
    const mod = await import("@/lib/agents/baseAgent");
    BaseAgent = mod.BaseAgent;
  });

  it("exposes id and name from config user_metadata", () => {
    class TestAgent extends BaseAgent {
      constructor() { super(googleConfig, []); }
    }
    const agent = new TestAgent();
    expect(agent.id).toBe("test-agent");
    expect(agent.name).toBe("Test Agent");
  });

  it("getCompiledGraph() returns a compiled graph object", () => {
    class TestAgent extends BaseAgent {
      constructor() { super(googleConfig, []); }
    }
    const agent = new TestAgent();
    expect(agent.getCompiledGraph()).toBeDefined();
  });

  it("run() returns a Response with a readable stream body", async () => {
    class TestAgent extends BaseAgent {
      constructor() { super(googleConfig, []); }
    }
    const agent = new TestAgent();
    const response = await agent.run([{ role: "user", content: "Hello" }]);
    expect(response).toBeInstanceOf(Response);
    expect(response.body).not.toBeNull();
  });
});
