import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for lib/agents/agentRegistry.ts
 *
 * Real AgentRegistry API:
 *   register(agent)           — adds agent to the Map
 *   getById(id)               — retrieves by agent.id
 *   getByToolName(toolName)   — retrieves by agent.toolName
 *   getAll()                  — returns all agents as array
 *   size                      — number of registered agents
 */

// Minimal mock agent instance — avoids importing BaseAgent (which needs LLM keys)
const makeMockInstance = (id: string) => ({
  id,
  name: id,
  run: vi.fn().mockResolvedValue(new Response("ok")),
});

const mockGraphFn = vi.fn().mockReturnValue({ invoke: vi.fn() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Registry = import("@/lib/agents/agentRegistry").AgentRegistry extends never ? any : Awaited<ReturnType<typeof import("@/lib/agents/agentRegistry").agentRegistry.getAll>> extends never ? any : {
  register: (a: unknown) => void;
  getById: (id: string) => unknown;
  getByToolName: (toolName: string) => unknown;
  getAll: () => unknown[];
  size: number;
};

describe("AgentRegistry", () => {
  let registry: {
    register: (a: unknown) => void;
    getById: (id: string) => unknown;
    getByToolName: (toolName: string) => unknown;
    getAll: () => unknown[];
    size: number;
  };

  beforeEach(async () => {
    // resetModules gives us a fresh singleton each test
    vi.resetModules();
    const mod = await import("@/lib/agents/agentRegistry");
    registry = mod.agentRegistry as typeof registry;
  });

  it("register() adds an agent retrievable by getById()", () => {
    registry.register({
      id: "test-agent",
      name: "Test Agent",
      toolName: "delegate_to_test",
      toolDescription: "Delegates to test agent",
      taskPrefix: "[Test Task]",
      instance: makeMockInstance("test-agent"),
      getCompiledGraph: mockGraphFn,
    });

    const agent = registry.getById("test-agent");
    expect(agent).toBeDefined();
    expect((agent as { id: string }).id).toBe("test-agent");
  });

  it("getById() returns undefined for an unregistered id", () => {
    expect(registry.getById("nonexistent")).toBeUndefined();
  });

  it("getByToolName() finds an agent by its toolName", () => {
    registry.register({
      id: "search-agent",
      name: "Search Agent",
      toolName: "delegate_to_search",
      toolDescription: "Searches the web",
      taskPrefix: "[Search Task]",
      instance: makeMockInstance("search-agent"),
      getCompiledGraph: mockGraphFn,
    });

    const agent = registry.getByToolName("delegate_to_search");
    expect(agent).toBeDefined();
    expect((agent as { id: string }).id).toBe("search-agent");
  });

  it("getByToolName() returns undefined for an unknown toolName", () => {
    expect(registry.getByToolName("delegate_to_nothing")).toBeUndefined();
  });

  it("getAll() returns all registered agents", () => {
    registry.register({
      id: "agent-a",
      name: "Agent A",
      toolName: "delegate_to_a",
      toolDescription: "A",
      taskPrefix: "[A]",
      instance: makeMockInstance("agent-a"),
      getCompiledGraph: mockGraphFn,
    });
    registry.register({
      id: "agent-b",
      name: "Agent B",
      toolName: "delegate_to_b",
      toolDescription: "B",
      taskPrefix: "[B]",
      instance: makeMockInstance("agent-b"),
      getCompiledGraph: mockGraphFn,
    });

    const all = registry.getAll();
    const ids = all.map((a) => (a as { id: string }).id);
    expect(ids).toContain("agent-a");
    expect(ids).toContain("agent-b");
  });

  it("size reflects the number of registered agents", () => {
    expect(registry.size).toBe(0);
    registry.register({
      id: "only-agent",
      name: "Only Agent",
      toolName: "delegate_to_only",
      toolDescription: "Only",
      taskPrefix: "[Only]",
      instance: makeMockInstance("only-agent"),
      getCompiledGraph: mockGraphFn,
    });
    expect(registry.size).toBe(1);
  });

  it("registering the same id twice overwrites (no throw)", () => {
    const entry = {
      id: "dup-agent",
      name: "Dup Agent",
      toolName: "delegate_to_dup",
      toolDescription: "Dup",
      taskPrefix: "[Dup]",
      instance: makeMockInstance("dup-agent"),
      getCompiledGraph: mockGraphFn,
    };
    expect(() => {
      registry.register(entry);
      registry.register({ ...entry, name: "Dup Agent v2" });
    }).not.toThrow();
    expect(registry.size).toBe(1);
    expect((registry.getById("dup-agent") as { name: string }).name).toBe("Dup Agent v2");
  });
});
