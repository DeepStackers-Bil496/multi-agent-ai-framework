import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_SERVER_URL = "https://api.githubcopilot.com/mcp/";

// Shared MCP client singleton
let mcpClient: Client | null = null;
let isConnected = false;

/**
 * Initialize MCP client connection to Remote GitHub MCP Server
 */
async function ensureConnected(): Promise<Client> {
    if (isConnected && mcpClient) {
        return mcpClient;
    }

    const githubPat = process.env.GITHUB_PAT;
    if (!githubPat) {
        throw new Error("GITHUB_PAT environment variable is not set.");
    }

    try {
        const transport = new StreamableHTTPClientTransport(
            new URL(MCP_SERVER_URL),
            {
                requestInit: {
                    headers: {
                        "Authorization": `Bearer ${githubPat}`,
                    },
                },
            }
        );

        mcpClient = new Client({
            name: "github-agent-mcp-client",
            version: "1.0.0",
        });

        await mcpClient.connect(transport);
        isConnected = true;
        console.log("[GitHubMCPTools] Connected to Remote GitHub MCP Server");
        return mcpClient;
    } catch (error) {
        console.error("[GitHubMCPTools] Failed to connect:", error);
        throw new Error(`Failed to connect to GitHub MCP Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Call a tool on the Remote GitHub MCP Server
 */
async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const client = await ensureConnected();
    console.log(`[GitHubMCPTools] Calling: ${toolName}`, args);
    return await client.callTool({ name: toolName, arguments: args });
}

/**
 * Extract content from MCP response format
 */
function extractContent(result: unknown): unknown {
    if (!result || typeof result !== "object") return result;

    const mcpResult = result as { content?: Array<{ type: string; text?: string }> };
    if (mcpResult.content && Array.isArray(mcpResult.content)) {
        const textContent = mcpResult.content.find(c => c.type === "text");
        if (textContent?.text) {
            try {
                return JSON.parse(textContent.text);
            } catch {
                return textContent.text;
            }
        }
    }
    return result;
}

/**
 * Format the MCP tool result for display
 */
function formatResult(tool: string, result: unknown): string {
    const content = extractContent(result);
    if (!content) return `No results found for ${tool} operation.`;
    if (typeof content === "string") return content;

    try {
        return `**${tool} Result:**\n\n\`\`\`json\n${JSON.stringify(content, null, 2)}\n\`\`\``;
    } catch {
        return `${tool} completed successfully.`;
    }
}

// =============================================================================
// INDIVIDUAL GITHUB MCP TOOLS
// =============================================================================

/**
 * list_commits - Get list of commits from a repository
 */
export function createListCommitsTool() {
    return new DynamicStructuredTool({
        name: "list_commits",
        description: "Get list of commits from a GitHub repository. Use to see commit history.",
        schema: z.object({
            owner: z.string().describe("Repository owner (e.g., 'oruccakir')"),
            repo: z.string().describe("Repository name"),
            sha: z.string().optional().describe("SHA or branch to start listing commits from"),
            perPage: z.number().optional().describe("Number of commits to return (default 10, max 100)"),
            page: z.number().optional().describe("Page number for pagination"),
        }),
        func: async ({ owner, repo, sha, perPage, page }) => {
            try {
                const result = await callMCPTool("list_commits", {
                    owner, repo,
                    perPage: perPage || 10,
                    ...(sha && { sha }),
                    ...(page && { page }),
                });
                return formatResult("list_commits", result);
            } catch (error) {
                return `Error in list_commits: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * get_commit - Get details of a specific commit
 */
export function createGetCommitTool() {
    return new DynamicStructuredTool({
        name: "get_commit",
        description: "Get details about a specific commit by SHA.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            sha: z.string().describe("Commit SHA to get details for"),
        }),
        func: async ({ owner, repo, sha }) => {
            try {
                const result = await callMCPTool("get_commit", { owner, repo, sha });
                return formatResult("get_commit", result);
            } catch (error) {
                return `Error in get_commit: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * get_file_contents - Get contents of a file from a repository
 */
export function createGetFileContentsTool() {
    return new DynamicStructuredTool({
        name: "get_file_contents",
        description: "Get the contents of a file or directory from a GitHub repository.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            path: z.string().describe("Path to file or directory"),
            ref: z.string().optional().describe("Git ref (branch, tag, or commit SHA)"),
        }),
        func: async ({ owner, repo, path, ref }) => {
            try {
                const result = await callMCPTool("get_file_contents", {
                    owner, repo, path,
                    ...(ref && { ref }),
                });
                return formatResult("get_file_contents", result);
            } catch (error) {
                return `Error in get_file_contents: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * search_repositories - Search for repositories on GitHub
 */
export function createSearchRepositoriesTool() {
    return new DynamicStructuredTool({
        name: "search_repositories",
        description: "Search for GitHub repositories by name, description, or topic.",
        schema: z.object({
            query: z.string().describe("Search query (e.g., 'machine learning language:python')"),
            perPage: z.number().optional().describe("Results per page (default 10, max 100)"),
            page: z.number().optional().describe("Page number"),
        }),
        func: async ({ query, perPage, page }) => {
            try {
                const result = await callMCPTool("search_repositories", {
                    query,
                    perPage: perPage || 10,
                    ...(page && { page }),
                });
                return formatResult("search_repositories", result);
            } catch (error) {
                return `Error in search_repositories: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * search_code - Search for code across GitHub repositories
 */
export function createSearchCodeTool() {
    return new DynamicStructuredTool({
        name: "search_code",
        description: "Search for code across GitHub repositories.",
        schema: z.object({
            query: z.string().describe("Search query (e.g., 'import React repo:user/repo')"),
            perPage: z.number().optional().describe("Results per page (default 10, max 100)"),
            page: z.number().optional().describe("Page number"),
        }),
        func: async ({ query, perPage, page }) => {
            try {
                const result = await callMCPTool("search_code", {
                    query,
                    perPage: perPage || 10,
                    ...(page && { page }),
                });
                return formatResult("search_code", result);
            } catch (error) {
                return `Error in search_code: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * list_branches - List branches in a repository
 */
export function createListBranchesTool() {
    return new DynamicStructuredTool({
        name: "list_branches",
        description: "List all branches in a GitHub repository.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            perPage: z.number().optional().describe("Results per page (default 30, max 100)"),
            page: z.number().optional().describe("Page number"),
        }),
        func: async ({ owner, repo, perPage, page }) => {
            try {
                const result = await callMCPTool("list_branches", {
                    owner, repo,
                    perPage: perPage || 30,
                    ...(page && { page }),
                });
                return formatResult("list_branches", result);
            } catch (error) {
                return `Error in list_branches: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * create_branch - Create a new branch in a repository
 */
export function createCreateBranchTool() {
    return new DynamicStructuredTool({
        name: "create_branch",
        description: "Create a new branch in a GitHub repository.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            branch: z.string().describe("Name for the new branch"),
            from_branch: z.string().optional().describe("Source branch (defaults to repo default)"),
        }),
        func: async ({ owner, repo, branch, from_branch }) => {
            try {
                const result = await callMCPTool("create_branch", {
                    owner, repo, branch,
                    ...(from_branch && { from_branch }),
                });
                return formatResult("create_branch", result);
            } catch (error) {
                return `Error in create_branch: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * list_tags - List tags in a repository
 */
export function createListTagsTool() {
    return new DynamicStructuredTool({
        name: "list_tags",
        description: "List all git tags in a GitHub repository.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            perPage: z.number().optional().describe("Results per page (default 10, max 100)"),
            page: z.number().optional().describe("Page number"),
        }),
        func: async ({ owner, repo, perPage, page }) => {
            try {
                const result = await callMCPTool("list_tags", {
                    owner, repo,
                    perPage: perPage || 10,
                    ...(page && { page }),
                });
                return formatResult("list_tags", result);
            } catch (error) {
                return `Error in list_tags: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * list_issues - List issues in a repository
 */
export function createListIssuesTool() {
    return new DynamicStructuredTool({
        name: "list_issues",
        description: "List issues in a GitHub repository. Can filter by state.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            state: z.enum(["OPEN", "CLOSED"]).optional().describe("Filter by state (OPEN or CLOSED)"),
            perPage: z.number().optional().describe("Results per page (default 10, max 100)"),
        }),
        func: async ({ owner, repo, state, perPage }) => {
            try {
                const result = await callMCPTool("list_issues", {
                    owner, repo,
                    perPage: perPage || 10,
                    ...(state && { state }),
                });
                return formatResult("list_issues", result);
            } catch (error) {
                return `Error in list_issues: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * issue_read - Get details of a specific issue
 */
export function createIssueReadTool() {
    return new DynamicStructuredTool({
        name: "issue_read",
        description: "Get details of a specific issue, its comments, labels, or sub-issues.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            issue_number: z.number().describe("Issue number"),
            method: z.enum(["get", "get_comments", "get_sub_issues", "get_labels"]).optional().describe("What to retrieve (default: get)"),
        }),
        func: async ({ owner, repo, issue_number, method }) => {
            try {
                const result = await callMCPTool("issue_read", {
                    owner, repo, issue_number,
                    method: method || "get",
                });
                return formatResult("issue_read", result);
            } catch (error) {
                return `Error in issue_read: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * issue_write - Create or update an issue
 */
export function createIssueWriteTool() {
    return new DynamicStructuredTool({
        name: "issue_write",
        description: "Create a new issue or update an existing issue in a repository.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            method: z.enum(["create", "update"]).describe("Create or update"),
            title: z.string().optional().describe("Issue title (required for create)"),
            body: z.string().optional().describe("Issue body content"),
            issue_number: z.number().optional().describe("Issue number (required for update)"),
            labels: z.array(z.string()).optional().describe("Labels to apply"),
            state: z.enum(["open", "closed"]).optional().describe("Issue state (for update)"),
        }),
        func: async ({ owner, repo, method, title, body, issue_number, labels, state }) => {
            try {
                const result = await callMCPTool("issue_write", {
                    owner, repo, method,
                    ...(title && { title }),
                    ...(body && { body }),
                    ...(issue_number && { issue_number }),
                    ...(labels && { labels }),
                    ...(state && { state }),
                });
                return formatResult("issue_write", result);
            } catch (error) {
                return `Error in issue_write: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * add_issue_comment - Add a comment to an issue
 */
export function createAddIssueCommentTool() {
    return new DynamicStructuredTool({
        name: "add_issue_comment",
        description: "Add a comment to an issue or pull request.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            issue_number: z.number().describe("Issue number to comment on"),
            body: z.string().describe("Comment content"),
        }),
        func: async ({ owner, repo, issue_number, body }) => {
            try {
                const result = await callMCPTool("add_issue_comment", {
                    owner, repo, issue_number, body,
                });
                return formatResult("add_issue_comment", result);
            } catch (error) {
                return `Error in add_issue_comment: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * search_issues - Search for issues across GitHub
 */
export function createSearchIssuesTool() {
    return new DynamicStructuredTool({
        name: "search_issues",
        description: "Search for issues across GitHub repositories.",
        schema: z.object({
            query: z.string().describe("Search query (e.g., 'is:open label:bug')"),
            owner: z.string().optional().describe("Filter by repository owner"),
            repo: z.string().optional().describe("Filter by repository name"),
            perPage: z.number().optional().describe("Results per page (default 10, max 100)"),
        }),
        func: async ({ query, owner, repo, perPage }) => {
            try {
                const result = await callMCPTool("search_issues", {
                    query,
                    perPage: perPage || 10,
                    ...(owner && { owner }),
                    ...(repo && { repo }),
                });
                return formatResult("search_issues", result);
            } catch (error) {
                return `Error in search_issues: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * list_pull_requests - List pull requests in a repository
 */
export function createListPullRequestsTool() {
    return new DynamicStructuredTool({
        name: "list_pull_requests",
        description: "List pull requests in a GitHub repository.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state"),
            perPage: z.number().optional().describe("Results per page (default 10, max 100)"),
            page: z.number().optional().describe("Page number"),
        }),
        func: async ({ owner, repo, state, perPage, page }) => {
            try {
                const result = await callMCPTool("list_pull_requests", {
                    owner, repo,
                    perPage: perPage || 10,
                    ...(state && { state }),
                    ...(page && { page }),
                });
                return formatResult("list_pull_requests", result);
            } catch (error) {
                return `Error in list_pull_requests: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * pull_request_read - Get details of a specific pull request
 */
export function createPullRequestReadTool() {
    return new DynamicStructuredTool({
        name: "pull_request_read",
        description: "Get details of a pull request: info, diff, files, reviews, or comments.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            pullNumber: z.number().describe("Pull request number"),
            method: z.enum(["get", "get_diff", "get_status", "get_files", "get_review_comments", "get_reviews", "get_comments"]).optional().describe("What to retrieve (default: get)"),
        }),
        func: async ({ owner, repo, pullNumber, method }) => {
            try {
                const result = await callMCPTool("pull_request_read", {
                    owner, repo, pullNumber,
                    method: method || "get",
                });
                return formatResult("pull_request_read", result);
            } catch (error) {
                return `Error in pull_request_read: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * search_pull_requests - Search for pull requests across GitHub
 */
export function createSearchPullRequestsTool() {
    return new DynamicStructuredTool({
        name: "search_pull_requests",
        description: "Search for pull requests across GitHub repositories.",
        schema: z.object({
            query: z.string().describe("Search query (e.g., 'is:open author:username')"),
            owner: z.string().optional().describe("Filter by repository owner"),
            repo: z.string().optional().describe("Filter by repository name"),
            perPage: z.number().optional().describe("Results per page (default 10, max 100)"),
        }),
        func: async ({ query, owner, repo, perPage }) => {
            try {
                const result = await callMCPTool("search_pull_requests", {
                    query,
                    perPage: perPage || 10,
                    ...(owner && { owner }),
                    ...(repo && { repo }),
                });
                return formatResult("search_pull_requests", result);
            } catch (error) {
                return `Error in search_pull_requests: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * push_files - Push multiple files to a repository in a single commit
 */
export function createPushFilesTool() {
    return new DynamicStructuredTool({
        name: "push_files",
        description: "Push multiple files to a GitHub repository in a single commit.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            branch: z.string().describe("Branch to push to"),
            message: z.string().describe("Commit message"),
            files: z.array(z.object({
                path: z.string().describe("File path"),
                content: z.string().describe("File content"),
            })).describe("Array of files to push"),
        }),
        func: async ({ owner, repo, branch, message, files }) => {
            try {
                const result = await callMCPTool("push_files", {
                    owner, repo, branch, message, files,
                });
                return formatResult("push_files", result);
            } catch (error) {
                return `Error in push_files: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * create_or_update_file - Create or update a single file
 */
export function createCreateOrUpdateFileTool() {
    return new DynamicStructuredTool({
        name: "create_or_update_file",
        description: "Create or update a single file in a GitHub repository.",
        schema: z.object({
            owner: z.string().describe("Repository owner"),
            repo: z.string().describe("Repository name"),
            path: z.string().describe("Path to the file"),
            content: z.string().describe("New file content"),
            message: z.string().describe("Commit message"),
            branch: z.string().describe("Branch to commit to"),
            sha: z.string().optional().describe("SHA of the file being replaced (required for updates)"),
        }),
        func: async ({ owner, repo, path, content, message, branch, sha }) => {
            try {
                const result = await callMCPTool("create_or_update_file", {
                    owner, repo, path, content, message, branch,
                    ...(sha && { sha }),
                });
                return formatResult("create_or_update_file", result);
            } catch (error) {
                return `Error in create_or_update_file: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * get_me - Get details of the authenticated GitHub user
 */
export function createGetMeTool() {
    return new DynamicStructuredTool({
        name: "get_me",
        description: "Get details of the authenticated GitHub user (your own profile).",
        schema: z.object({}),
        func: async () => {
            try {
                const result = await callMCPTool("get_me", {});
                return formatResult("get_me", result);
            } catch (error) {
                return `Error in get_me: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * Create all GitHub MCP tools as an array
 * This is the main export for use with LangChain/LangGraph
 */
export function createAllGitHubMCPTools(): DynamicStructuredTool[] {
    return [
        // Repository operations
        createListCommitsTool(),
        createGetCommitTool(),
        createGetFileContentsTool(),
        createSearchRepositoriesTool(),
        createSearchCodeTool(),
        createListBranchesTool(),
        createCreateBranchTool(),
        createListTagsTool(),
        // Issue operations
        createListIssuesTool(),
        createIssueReadTool(),
        createIssueWriteTool(),
        createAddIssueCommentTool(),
        createSearchIssuesTool(),
        // PR operations
        createListPullRequestsTool(),
        createPullRequestReadTool(),
        createSearchPullRequestsTool(),
        // File operations
        createPushFilesTool(),
        createCreateOrUpdateFileTool(),
        // User operations
        createGetMeTool(),
    ];
}
