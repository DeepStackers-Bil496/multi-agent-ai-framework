import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Integration tests for lib/agents/mainAgent/delegationToolFactory.ts
 *
 * Verifies that createDelegationToolsFromRegistry() correctly reflects the
 * live state of the AgentRegistry — tool names, descriptions, schemas, and
 * the func stub return value.
 *
 * The real AgentRegistry singleton is used (reset per test via vi.resetModules)
 * so these tests also exercise the registry↔factory integration path.
 */

const makeMockInstance = (id: string) => ({
  id,
  name: id,
  run: vi.fn().mockResolvedValue(new Response("ok")),
});

const mockGraph = vi.fn().mockReturnValue({ invoke: vi.fn() });

describe("DelegationToolFactory", () => {
  let agentRegistry: Awaited<
    ReturnType<typeof import("@/lib/agents/agentRegistry")["agentRegistry"]["getAll"]>
  > extends (infer T)[] ? { register: (a: T) => void; getAll: () => T[]; size: number } : never;
  let createDelegationToolsFromRegistry: () => import("@langchain/core/tools").DynamicStructuredTool[];

  beforeEach(async () => {
    vi.resetModules();
    const regMod = await import("@/lib/agents/agentRegistry");
    const factMod = await import("@/lib/agents/mainAgent/delegationToolFactory");
    agentRegistry = regMod.agentRegistry as typeof agentRegistry;
    createDelegationToolsFromRegistry = factMod.createDelegationToolsFromRegistry;
  });

  it("returns an empty array when no agents are registered", () => {
    const tools = createDelegationToolsFromRegistry();
    expect(tools).toEqual([]);
  });

  it("returns one tool per registered agent", () => {
    agentRegistry.register({
      id: "alpha",
      name: "Alpha Agent",
      toolName: "delegate_to_alpha",
      toolDescription: "Handles alpha tasks",
      taskPrefix: "[Alpha Task]",
      instance: makeMockInstance("alpha"),
      getCompiledGraph: mockGraph,
    });

    agentRegistry.register({
      id: "beta",
      name: "Beta Agent",
      toolName: "delegate_to_beta",
      toolDescription: "Handles beta tasks",
      taskPrefix: "[Beta Task]",
      instance: makeMockInstance("beta"),
      getCompiledGraph: mockGraph,
    });

    const tools = createDelegationToolsFromRegistry();
    expect(tools).toHaveLength(2);
  });

  it("tool names match registry toolName values", () => {
    agentRegistry.register({
      id: "github",
      name: "GitHub Agent",
      toolName: "delegate_to_github",
      toolDescription: "GitHub operations",
      taskPrefix: "[GitHub Task]",
      instance: makeMockInstance("github"),
      getCompiledGraph: mockGraph,
    });

    const tools = createDelegationToolsFromRegistry();
    const names = tools.map((t) => t.name);
    expect(names).toContain("delegate_to_github");
  });

  it("tool descriptions match registry toolDescription values", () => {
    agentRegistry.register({
      id: "search",
      name: "Search Agent",
      toolName: "delegate_to_search",
      toolDescription: "Web search operations",
      taskPrefix: "[Search Task]",
      instance: makeMockInstance("search"),
      getCompiledGraph: mockGraph,
    });

    const tools = createDelegationToolsFromRegistry();
    const descriptions = tools.map((t) => t.description);
    expect(descriptions).toContain("Web search operations");
  });

  it("each tool has a 'task' parameter in its schema", () => {
    agentRegistry.register({
      id: "codebase",
      name: "Codebase Agent",
      toolName: "delegate_to_codebase",
      toolDescription: "Code search",
      taskPrefix: "[Codebase Task]",
      instance: makeMockInstance("codebase"),
      getCompiledGraph: mockGraph,
    });

    const [tool] = createDelegationToolsFromRegistry();
    // DynamicStructuredTool exposes schema as a Zod object
    const shape = (tool.schema as { shape?: Record<string, unknown> }).shape;
    expect(shape).toBeDefined();
    expect(shape).toHaveProperty("task");
  });

  it("tool func returns a delegation confirmation string", async () => {
    agentRegistry.register({
      id: "vision",
      name: "Vision Agent",
      toolName: "delegate_to_vision",
      toolDescription: "Image tasks",
      taskPrefix: "[Vision Task]",
      instance: makeMockInstance("vision"),
      getCompiledGraph: mockGraph,
    });

    const [tool] = createDelegationToolsFromRegistry();
    const result = await tool.invoke({ task: "Analyze this image" });
    expect(typeof result).toBe("string");
    expect(result).toContain("Vision Agent");
    expect(result).toContain("Analyze this image");
  });

  it("reflects dynamically added agents — tools are built from registry state at call time", () => {
    // First call: empty
    expect(createDelegationToolsFromRegistry()).toHaveLength(0);

    // Register one agent
    agentRegistry.register({
      id: "late-agent",
      name: "Late Agent",
      toolName: "delegate_to_late",
      toolDescription: "Added late",
      taskPrefix: "[Late Task]",
      instance: makeMockInstance("late-agent"),
      getCompiledGraph: mockGraph,
    });

    // Second call: should see the new agent
    expect(createDelegationToolsFromRegistry()).toHaveLength(1);
  });
});
