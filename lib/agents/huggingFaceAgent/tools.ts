import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_SERVER_URL = "https://huggingface.co/mcp";

// Shared MCP client singleton
let mcpClient: Client | null = null;
let isConnected = false;
let currentRuntimeSecrets: Record<string, string> | undefined;

/**
 * Initialize MCP client connection to Remote Hugging Face MCP Server
 * @param runtimeSecrets Optional runtime secrets from database
 */
async function ensureConnected(runtimeSecrets?: Record<string, string>): Promise<Client> {
    // Reconnect if secrets changed
    if (isConnected && mcpClient && runtimeSecrets !== currentRuntimeSecrets) {
        isConnected = false;
        mcpClient = null;
    }

    if (isConnected && mcpClient) {
        return mcpClient;
    }

    // Try runtime secrets first, then fall back to environment variable
    const hfToken = runtimeSecrets?.["HF_TOKEN"] || process.env.HF_TOKEN;
    if (!hfToken) {
        throw new Error("HF_TOKEN is not configured. Please set it in agent settings or environment variables.");
    }

    currentRuntimeSecrets = runtimeSecrets;

    try {
        const transport = new StreamableHTTPClientTransport(
            new URL(MCP_SERVER_URL),
            {
                requestInit: {
                    headers: {
                        "Authorization": `Bearer ${hfToken}`,
                    },
                },
            }
        );

        mcpClient = new Client({
            name: "huggingface-agent-mcp-client",
            version: "1.0.0",
        });

        await mcpClient.connect(transport);
        isConnected = true;
        console.log("[HuggingFaceMCPTools] Connected to Remote Hugging Face MCP Server");
        return mcpClient;
    } catch (error) {
        console.error("[HuggingFaceMCPTools] Failed to connect:", error);
        throw new Error(`Failed to connect to Hugging Face MCP Server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Call a tool on the Remote Hugging Face MCP Server
 * @param toolName Name of the tool to call
 * @param args Arguments for the tool  
 * @param runtimeSecrets Optional runtime secrets from database
 */
async function callMCPTool(toolName: string, args: Record<string, unknown>, runtimeSecrets?: Record<string, string>): Promise<unknown> {
    // Use passed secrets, or fall back to module-level currentRuntimeSecrets
    const secretsToUse = runtimeSecrets ?? currentRuntimeSecrets;
    const client = await ensureConnected(secretsToUse);
    console.log(`[HuggingFaceMCPTools] Calling: ${toolName}`, args);
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
// HUGGING FACE MCP TOOLS
// =============================================================================

/**
 * hf_whoami - Check authenticated Hugging Face user
 */
export function createWhoAmITool() {
    return new DynamicStructuredTool({
        name: "hf_whoami",
        description: "Check the authenticated Hugging Face user. Use to verify connection and see user info.",
        schema: z.object({}),
        func: async () => {
            try {
                const result = await callMCPTool("hf_whoami", {});
                return formatResult("hf_whoami", result);
            } catch (error) {
                return `Error in hf_whoami: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * model_search - Search for ML models on Hugging Face Hub
 */
export function createModelSearchTool() {
    return new DynamicStructuredTool({
        name: "model_search",
        description: "Search for ML models on Hugging Face Hub. Find models by query, author, task type, or library. Leave query blank with sort option to get trending/popular models.",
        schema: z.object({
            query: z.string().optional().describe("Search term for models"),
            author: z.string().optional().describe("Filter by organization/user (e.g., 'google', 'meta-llama', 'microsoft')"),
            task: z.string().optional().describe("Filter by task type (e.g., 'text-generation', 'image-classification', 'translation')"),
            library: z.string().optional().describe("Filter by framework (e.g., 'transformers', 'diffusers', 'timm')"),
            sort: z.enum(["trendingScore", "downloads", "likes", "createdAt", "lastModified"]).optional().describe("Sort order for results"),
            limit: z.number().min(1).max(100).optional().describe("Maximum number of results (default 20, max 100)"),
        }),
        func: async ({ query, author, task, library, sort, limit }) => {
            try {
                const args: Record<string, unknown> = {};
                if (query) args.query = query;
                if (author) args.author = author;
                if (task) args.task = task;
                if (library) args.library = library;
                if (sort) args.sort = sort;
                if (limit) args.limit = limit;

                const result = await callMCPTool("model_search", args);
                return formatResult("model_search", result);
            } catch (error) {
                return `Error in model_search: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * dataset_search - Search for datasets on Hugging Face Hub
 */
export function createDatasetSearchTool() {
    return new DynamicStructuredTool({
        name: "dataset_search",
        description: "Search for datasets on Hugging Face Hub. Find datasets by query, author, or tags. Leave query blank with sort option to get trending/popular datasets.",
        schema: z.object({
            query: z.string().optional().describe("Search term for datasets"),
            author: z.string().optional().describe("Filter by organization/user (e.g., 'google', 'facebook', 'allenai')"),
            tags: z.array(z.string()).optional().describe("Tags to filter datasets (e.g., ['language:en', 'task_categories:text-classification'])"),
            sort: z.enum(["trendingScore", "downloads", "likes", "createdAt", "lastModified"]).optional().describe("Sort order for results"),
            limit: z.number().min(1).max(100).optional().describe("Maximum number of results (default 20, max 100)"),
        }),
        func: async ({ query, author, tags, sort, limit }) => {
            try {
                const args: Record<string, unknown> = {};
                if (query) args.query = query;
                if (author) args.author = author;
                if (tags) args.tags = tags;
                if (sort) args.sort = sort;
                if (limit) args.limit = limit;

                const result = await callMCPTool("dataset_search", args);
                return formatResult("dataset_search", result);
            } catch (error) {
                return `Error in dataset_search: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * paper_search - Search for ML research papers on Hugging Face Hub
 */
export function createPaperSearchTool() {
    return new DynamicStructuredTool({
        name: "paper_search",
        description: "Search for ML research papers on Hugging Face Hub using semantic search. Great for finding research on specific topics.",
        schema: z.object({
            query: z.string().min(3).max(200).describe("Semantic search query for papers"),
            results_limit: z.number().min(1).max(50).optional().describe("Number of results to return (default 12)"),
            concise_only: z.boolean().optional().describe("Return 2-sentence summary instead of full abstract (default false)"),
        }),
        func: async ({ query, results_limit, concise_only }) => {
            try {
                const args: Record<string, unknown> = { query };
                if (results_limit) args.results_limit = results_limit;
                if (concise_only !== undefined) args.concise_only = concise_only;

                const result = await callMCPTool("paper_search", args);
                return formatResult("paper_search", result);
            } catch (error) {
                return `Error in paper_search: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * space_search - Search for Hugging Face Spaces
 */
export function createSpaceSearchTool() {
    return new DynamicStructuredTool({
        name: "space_search",
        description: "Search for Hugging Face Spaces using semantic search. Set mcp=true to find MCP-enabled Spaces that can be used with dynamic_space tool.",
        schema: z.object({
            query: z.string().min(1).max(100).describe("Semantic search query for Spaces"),
            limit: z.number().min(1).max(50).optional().describe("Number of results to return (default 10)"),
            mcp: z.boolean().optional().describe("Only return MCP Server enabled Spaces (default false)"),
        }),
        func: async ({ query, limit, mcp }) => {
            try {
                const args: Record<string, unknown> = { query };
                if (limit) args.limit = limit;
                if (mcp !== undefined) args.mcp = mcp;

                const result = await callMCPTool("space_search", args);
                return formatResult("space_search", result);
            } catch (error) {
                return `Error in space_search: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * hub_repo_details - Get details for Hugging Face repositories
 */
export function createHubRepoDetailsTool() {
    return new DynamicStructuredTool({
        name: "hub_repo_details",
        description: "Get detailed information about one or more Hugging Face repositories (models, datasets, or spaces). Returns downloads, likes, tags, and links.",
        schema: z.object({
            repo_ids: z.array(z.string().min(1)).min(1).max(10).describe("Repo IDs in author/name format (e.g., ['openai/whisper-large-v3', 'meta-llama/Llama-2-7b'])"),
            repo_type: z.enum(["model", "dataset", "space"]).optional().describe("Specify lookup type; otherwise auto-detects"),
        }),
        func: async ({ repo_ids, repo_type }) => {
            try {
                const args: Record<string, unknown> = { repo_ids };
                if (repo_type) args.repo_type = repo_type;

                const result = await callMCPTool("hub_repo_details", args);
                return formatResult("hub_repo_details", result);
            } catch (error) {
                return `Error in hub_repo_details: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * hf_doc_search - Search Hugging Face documentation
 */
export function createDocSearchTool() {
    return new DynamicStructuredTool({
        name: "hf_doc_search",
        description: "Search Hugging Face product and library documentation. Send empty query to discover structure. Use product filter for focused results.",
        schema: z.object({
            query: z.string().max(200).describe("Semantic query for documentation search. Empty string returns structure overview."),
            product: z.string().optional().describe("Filter by product (e.g., 'transformers', 'diffusers', 'hub', 'gradio')"),
        }),
        func: async ({ query, product }) => {
            try {
                const args: Record<string, unknown> = { query };
                if (product) args.product = product;

                const result = await callMCPTool("hf_doc_search", args);
                return formatResult("hf_doc_search", result);
            } catch (error) {
                return `Error in hf_doc_search: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * hf_doc_fetch - Fetch a Hugging Face documentation page
 */
export function createDocFetchTool() {
    return new DynamicStructuredTool({
        name: "hf_doc_fetch",
        description: "Fetch a specific documentation page from Hugging Face or Gradio docs by URL. Use offset for large documents.",
        schema: z.object({
            doc_url: z.string().max(200).describe("Documentation URL (Hugging Face or Gradio)"),
            offset: z.number().min(0).optional().describe("Token offset for large documents (use offset from truncation message)"),
        }),
        func: async ({ doc_url, offset }) => {
            try {
                const args: Record<string, unknown> = { doc_url };
                if (offset !== undefined) args.offset = offset;

                const result = await callMCPTool("hf_doc_fetch", args);
                return formatResult("hf_doc_fetch", result);
            } catch (error) {
                return `Error in hf_doc_fetch: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * dynamic_space - Run ML tasks on MCP-enabled Hugging Face Spaces
 */
export function createDynamicSpaceTool() {
    return new DynamicStructuredTool({
        name: "dynamic_space",
        description: `Perform ML tasks using Hugging Face Spaces. Use "discover" to see available tasks (image generation, OCR, TTS, etc.). Use "view_parameters" to see required params for a Space. Use "invoke" to execute a task.`,
        schema: z.object({
            operation: z.enum(["discover", "view_parameters", "invoke"]).describe("Operation: discover (list tasks), view_parameters (show Space params), invoke (execute task)"),
            space_name: z.string().optional().describe("Space ID in 'username/space-name' format. Required for view_parameters and invoke."),
            parameters: z.string().optional().describe("JSON object string of parameters. Only used for 'invoke' operation."),
        }),
        func: async ({ operation, space_name, parameters }) => {
            try {
                const args: Record<string, unknown> = { operation };
                if (space_name) args.space_name = space_name;
                if (parameters) args.parameters = parameters;

                const result = await callMCPTool("dynamic_space", args);
                return formatResult("dynamic_space", result);
            } catch (error) {
                return `Error in dynamic_space: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

// =============================================================================
// TOOL COLLECTION
// =============================================================================

/**
 * Create all Hugging Face MCP tools
 * @param runtimeSecrets Optional runtime secrets from database
 */
export function createAllHuggingFaceMCPTools(runtimeSecrets?: Record<string, string>): DynamicStructuredTool[] {
    // Set module-level secrets so tools can access them via callMCPTool
    if (runtimeSecrets) {
        currentRuntimeSecrets = runtimeSecrets;
    }

    // The existing tool creators call callMCPTool without secrets parameter,
    // but callMCPTool will use currentRuntimeSecrets that was set by ensureConnected()
    // when the first tool is called. This works because ensureConnected() is called
    // on every callMCPTool invocation and caches the runtime secrets.
    return [
        // User info
        createWhoAmITool(),
        // Search tools
        createModelSearchTool(),
        createDatasetSearchTool(),
        createPaperSearchTool(),
        createSpaceSearchTool(),
        // Repository details
        createHubRepoDetailsTool(),
        // Documentation tools
        createDocSearchTool(),
        createDocFetchTool(),
        // Dynamic Space tasks
        createDynamicSpaceTool(),
    ];
}
