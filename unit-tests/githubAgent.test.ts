import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for lib/agents/githubAgent/tools.ts
 *
 * Real exports:
 *   createAllGitHubMCPTools(runtimeSecrets?) — returns all 19 MCP-backed tools
 *   Individual factory functions:
 *     createListCommitsTool, createGetCommitTool, createGetFileContentsTool,
 *     createSearchRepositoriesTool, createSearchCodeTool, createListBranchesTool,
 *     createCreateBranchTool, createListTagsTool, createListIssuesTool,
 *     createIssueReadTool, createIssueWriteTool, createAddIssueCommentTool,
 *     createSearchIssuesTool, createListPullRequestsTool, createPullRequestReadTool,
 *     createSearchPullRequestsTool, createPushFilesTool,
 *     createCreateOrUpdateFileTool, createGetMeTool
 *
 * We mock the MCP SDK so no real network connections are made.
 * Tool invocations test the graceful error path: connection fails, tool
 * must return a string instead of throwing.
 */

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(function () {
    return {
      connect: vi.fn().mockRejectedValue(new Error("MCP connection not available in test")),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify({ result: "mock result" }) }],
      }),
    };
  }),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

describe("GitHubAgent Tools", () => {
  let mod: typeof import("@/lib/agents/githubAgent/tools");

  beforeEach(async () => {
    vi.resetModules();
    vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
      Client: vi.fn().mockImplementation(function () {
        return {
          connect: vi.fn().mockRejectedValue(new Error("MCP connection not available in test")),
          callTool: vi.fn().mockResolvedValue({
            content: [{ type: "text", text: JSON.stringify({ result: "mock result" }) }],
          }),
        };
      }),
    }));
    vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
      StreamableHTTPClientTransport: vi.fn().mockImplementation(function () {
        return {};
      }),
    }));
    mod = await import("@/lib/agents/githubAgent/tools");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- createAllGitHubMCPTools() ---

  it("createAllGitHubMCPTools() returns a non-empty array", () => {
    const tools = mod.createAllGitHubMCPTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("createAllGitHubMCPTools() returns exactly 19 tools", () => {
    const tools = mod.createAllGitHubMCPTools();
    expect(tools.length).toBe(19);
  });

  it("every tool has a non-empty name and description", () => {
    const tools = mod.createAllGitHubMCPTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it("createAllGitHubMCPTools() with runtimeSecrets still returns 19 tools", () => {
    const tools = mod.createAllGitHubMCPTools({ GITHUB_PAT: "ghp_test123" });
    expect(tools.length).toBe(19);
  });

  // --- All expected tool names are present ---

  const expectedToolNames = [
    "list_commits",
    "get_commit",
    "get_file_contents",
    "search_repositories",
    "search_code",
    "list_branches",
    "create_branch",
    "list_tags",
    "list_issues",
    "issue_read",
    "issue_write",
    "add_issue_comment",
    "search_issues",
    "list_pull_requests",
    "pull_request_read",
    "search_pull_requests",
    "push_files",
    "create_or_update_file",
    "get_me",
  ];

  for (const toolName of expectedToolNames) {
    it(`tool '${toolName}' is present in createAllGitHubMCPTools()`, () => {
      const tools = mod.createAllGitHubMCPTools();
      expect(tools.find((t) => t.name === toolName)).toBeDefined();
    });
  }

  // --- Individual factory functions return tools with correct names ---

  it("createListCommitsTool() returns a tool named 'list_commits'", () => {
    expect(mod.createListCommitsTool().name).toBe("list_commits");
  });

  it("createGetCommitTool() returns a tool named 'get_commit'", () => {
    expect(mod.createGetCommitTool().name).toBe("get_commit");
  });

  it("createGetFileContentsTool() returns a tool named 'get_file_contents'", () => {
    expect(mod.createGetFileContentsTool().name).toBe("get_file_contents");
  });

  it("createSearchRepositoriesTool() returns a tool named 'search_repositories'", () => {
    expect(mod.createSearchRepositoriesTool().name).toBe("search_repositories");
  });

  it("createSearchCodeTool() returns a tool named 'search_code'", () => {
    expect(mod.createSearchCodeTool().name).toBe("search_code");
  });

  it("createListBranchesTool() returns a tool named 'list_branches'", () => {
    expect(mod.createListBranchesTool().name).toBe("list_branches");
  });

  it("createCreateBranchTool() returns a tool named 'create_branch'", () => {
    expect(mod.createCreateBranchTool().name).toBe("create_branch");
  });

  it("createListIssuesTool() returns a tool named 'list_issues'", () => {
    expect(mod.createListIssuesTool().name).toBe("list_issues");
  });

  it("createIssueWriteTool() returns a tool named 'issue_write'", () => {
    expect(mod.createIssueWriteTool().name).toBe("issue_write");
  });

  it("createPushFilesTool() returns a tool named 'push_files'", () => {
    expect(mod.createPushFilesTool().name).toBe("push_files");
  });

  it("createGetMeTool() returns a tool named 'get_me'", () => {
    expect(mod.createGetMeTool().name).toBe("get_me");
  });

  // --- Invocation error handling: MCP unavailable must return string, not throw ---

  it("list_commits invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createListCommitsTool().invoke({ owner: "testuser", repo: "testrepo" });
    expect(typeof result).toBe("string");
  });

  it("get_commit invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createGetCommitTool().invoke({
      owner: "testuser",
      repo: "testrepo",
      sha: "abc123",
    });
    expect(typeof result).toBe("string");
  });

  it("get_file_contents invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createGetFileContentsTool().invoke({
      owner: "testuser",
      repo: "testrepo",
      path: "README.md",
    });
    expect(typeof result).toBe("string");
  });

  it("search_repositories invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createSearchRepositoriesTool().invoke({ query: "langchain typescript" });
    expect(typeof result).toBe("string");
  });

  it("list_issues invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createListIssuesTool().invoke({ owner: "testuser", repo: "testrepo" });
    expect(typeof result).toBe("string");
  });

  it("issue_write invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createIssueWriteTool().invoke({
      owner: "testuser",
      repo: "testrepo",
      method: "create",
      title: "Test issue",
    });
    expect(typeof result).toBe("string");
  });

  it("push_files invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createPushFilesTool().invoke({
      owner: "testuser",
      repo: "testrepo",
      branch: "main",
      message: "test commit",
      files: [{ path: "test.txt", content: "hello" }],
    });
    expect(typeof result).toBe("string");
  });

  it("get_me invoke returns a string when MCP is unavailable", async () => {
    const result = await mod.createGetMeTool().invoke({});
    expect(typeof result).toBe("string");
  });
});
