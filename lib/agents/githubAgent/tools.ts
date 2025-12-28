import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * GitHub MCP Tool Schema - Defines all available GitHub operations
 * Note: GitHub MCP Server uses CURSOR-BASED pagination (after/endCursor), NOT page numbers
 */
export const GitHubMCPSchema = z.object({
    tool: z.enum([
        // Repository operations
        "list_commits",
        "get_file_contents",
        "search_repositories",
        "search_code",
        "list_branches",
        "create_branch",
        "get_commit",
        "list_tags",
        // Issue operations
        "list_issues",
        "get_issue",
        "create_issue",
        "add_issue_comment",
        "search_issues",
        // PR operations
        "list_pull_requests",
        "pull_request_read",
        "search_pull_requests",
        // File operations
        "push_files",
        "create_or_update_file",
        // User operations
        "get_me",
    ]).describe("The GitHub MCP tool to invoke"),

    // Common parameters
    owner: z.string().optional().describe("Repository owner (e.g., 'oruccakir')"),
    repo: z.string().optional().describe("Repository name (e.g., 'Evangeline')"),

    // Cursor-based pagination (GitHub MCP uses cursors, NOT page numbers)
    first: z.number().optional().describe("Number of items to fetch (default: 10, max: 100)"),
    after: z.string().optional().describe("Cursor for pagination - use endCursor from previous response"),

    // Issue/PR specific
    issueNumber: z.number().optional().describe("Issue or PR number"),
    pullNumber: z.number().optional().describe("Pull request number"),
    title: z.string().optional().describe("Title for new issue"),
    body: z.string().optional().describe("Body content for issue/comment"),
    labels: z.array(z.string()).optional().describe("Labels for issue"),
    state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state (open, closed, all)"),

    // File specific
    path: z.string().optional().describe("File path within repository"),
    ref: z.string().optional().describe("Git ref (branch, tag, or commit SHA)"),
    branch: z.string().optional().describe("Branch name"),
    sha: z.string().optional().describe("Commit SHA"),
    content: z.string().optional().describe("File content"),
    message: z.string().optional().describe("Commit message"),

    // Search specific
    query: z.string().optional().describe("Search query"),

    // PR read method
    method: z.string().optional().describe("Method for PR read operations (get, get_diff, get_files, get_reviews, get_comments)"),
});

export type GitHubMCPInput = z.infer<typeof GitHubMCPSchema>;

/**
 * Creates the GitHub MCP Tool for use with LangChain/LangGraph
 */
export function createGitHubMCPTool(): DynamicStructuredTool<typeof GitHubMCPSchema> {
    let mcpClient: Client | null = null;
    let isConnected = false;

    const MCP_SERVER_URL = "https://api.githubcopilot.com/mcp/";

    /**
     * Initialize MCP client connection to Remote GitHub MCP Server
     */
    async function ensureConnected(): Promise<Client> {
        if (isConnected && mcpClient) {
            return mcpClient;
        }

        const githubPat = process.env.GITHUB_PAT;
        if (!githubPat) {
            throw new Error("GITHUB_PAT environment variable is not set. Please set your GitHub Personal Access Token.");
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
            console.log("[GitHubMCPTool] Connected to Remote GitHub MCP Server");
            return mcpClient;
        } catch (error) {
            console.error("[GitHubMCPTool] Failed to connect:", error);
            throw new Error(`Failed to connect to GitHub MCP Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Call a tool on the Remote GitHub MCP Server
     */
    async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
        const client = await ensureConnected();
        console.log(`[GitHubMCPTool] Calling: ${toolName}`, args);
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

    return new DynamicStructuredTool({
        name: "github_mcp",
        description: `GitHub Agent Tool - Interact with GitHub using MCP Server.

IMPORTANT: This API uses CURSOR-BASED pagination. Do NOT use page numbers.
- Use 'first' to specify how many items to fetch (default 10)
- For next page, use 'after' with the 'endCursor' from previous response

AVAILABLE TOOLS:
📊 Repository: list_commits, get_file_contents, search_repositories, search_code, list_branches, create_branch, get_commit, list_tags
📝 Issues: list_issues, get_issue, create_issue, add_issue_comment, search_issues
🔀 Pull Requests: list_pull_requests, pull_request_read, search_pull_requests
📁 Files: push_files, create_or_update_file
👤 User: get_me

EXAMPLES:
- List issues: { tool: "list_issues", owner: "oruccakir", repo: "Evangeline", first: 20 }
- Get file: { tool: "get_file_contents", owner: "user", repo: "repo", path: "README.md" }
- Create issue: { tool: "create_issue", owner: "user", repo: "repo", title: "Bug found" }`,
        schema: GitHubMCPSchema,
        func: async (input: GitHubMCPInput): Promise<string> => {
            const { tool, owner, repo, first, after, issueNumber, pullNumber, title, body, labels, state, path, ref, branch, sha, content, message, query, method } = input;

            try {
                let result: unknown;

                switch (tool) {
                    // Repository Operations
                    case "list_commits":
                        result = await callMCPTool("list_commits", {
                            owner, repo,
                            first: first || 10,
                            ...(after && { after }),
                            ...(sha && { sha }),
                        });
                        break;

                    case "get_file_contents":
                        result = await callMCPTool("get_file_contents", {
                            owner, repo,
                            path: path || "",
                            ...(ref && { ref }),
                        });
                        break;

                    case "search_repositories":
                        result = await callMCPTool("search_repositories", {
                            query: query!,
                            first: first || 10,
                            ...(after && { after }),
                        });
                        break;

                    case "search_code":
                        result = await callMCPTool("search_code", {
                            query: query!,
                            first: first || 10,
                            ...(after && { after }),
                        });
                        break;

                    case "list_branches":
                        result = await callMCPTool("list_branches", {
                            owner, repo,
                            first: first || 30,
                            ...(after && { after }),
                        });
                        break;

                    case "create_branch":
                        result = await callMCPTool("create_branch", {
                            owner, repo,
                            branch: branch!,
                            ...(ref && { from_branch: ref }),
                        });
                        break;

                    case "get_commit":
                        result = await callMCPTool("get_commit", { owner, repo, sha: sha! });
                        break;

                    case "list_tags":
                        result = await callMCPTool("list_tags", {
                            owner, repo,
                            first: first || 10,
                            ...(after && { after }),
                        });
                        break;

                    // Issue Operations
                    case "list_issues":
                        result = await callMCPTool("list_issues", {
                            owner, repo,
                            first: first || 10,
                            ...(after && { after }),
                            ...(state && { state }),
                        });
                        break;

                    case "get_issue":
                        result = await callMCPTool("get_issue", { owner, repo, issueNumber: issueNumber! });
                        break;

                    case "create_issue":
                        result = await callMCPTool("create_issue", {
                            owner, repo,
                            title: title!,
                            ...(body && { body }),
                            ...(labels && { labels }),
                        });
                        break;

                    case "add_issue_comment":
                        result = await callMCPTool("add_issue_comment", {
                            owner, repo,
                            issue_number: issueNumber!,
                            body: body!,
                        });
                        break;

                    case "search_issues":
                        result = await callMCPTool("search_issues", {
                            query: query!,
                            first: first || 10,
                            ...(after && { after }),
                        });
                        break;

                    // PR Operations
                    case "list_pull_requests":
                        result = await callMCPTool("list_pull_requests", {
                            owner, repo,
                            first: first || 10,
                            ...(after && { after }),
                        });
                        break;

                    case "pull_request_read":
                        result = await callMCPTool("pull_request_read", {
                            owner, repo,
                            pullNumber: pullNumber!,
                            method: method || "get",
                        });
                        break;

                    case "search_pull_requests":
                        result = await callMCPTool("search_pull_requests", {
                            query: query!,
                            first: first || 10,
                            ...(after && { after }),
                        });
                        break;

                    // File Operations
                    case "push_files":
                        result = await callMCPTool("push_files", {
                            owner, repo,
                            branch: branch!,
                            message: message!,
                            files: [{ path: path!, content: content! }],
                        });
                        break;

                    case "create_or_update_file":
                        result = await callMCPTool("create_or_update_file", {
                            owner, repo,
                            path: path!,
                            content: content!,
                            message: message!,
                            branch: branch!,
                        });
                        break;

                    // User Operations
                    case "get_me":
                        result = await callMCPTool("get_me", {});
                        break;

                    default:
                        return `Unknown tool: ${tool}. Please use one of the available MCP tools.`;
                }

                return formatResult(tool, result);

            } catch (error) {
                console.error("[GitHubMCPTool] Error:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                return `GitHub MCP Error: ${errorMessage}

**Troubleshooting:**
1. Ensure GITHUB_PAT environment variable is set
2. Ensure your token has the required scopes (repo, read:org, etc.)
3. Check if the GitHub MCP Server is available`;
            }
        },
    });
}
