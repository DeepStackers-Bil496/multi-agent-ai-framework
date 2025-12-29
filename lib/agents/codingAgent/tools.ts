import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { Sandbox } from "@e2b/code-interpreter";

// Shared sandbox instance (reused across tool calls for session persistence)
let sandboxInstance: Sandbox | null = null;
let sandboxTimeout: NodeJS.Timeout | null = null;

const SANDBOX_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Reset the sandbox instance (called when sandbox is no longer valid)
 */
function resetSandbox() {
    sandboxInstance = null;
    if (sandboxTimeout) {
        clearTimeout(sandboxTimeout);
        sandboxTimeout = null;
    }
}

/**
 * Get or create a sandbox instance
 */
async function getSandbox(): Promise<Sandbox> {
    // Reset the idle timeout
    if (sandboxTimeout) {
        clearTimeout(sandboxTimeout);
    }

    if (sandboxInstance) {
        // Set new idle timeout
        sandboxTimeout = setTimeout(async () => {
            if (sandboxInstance) {
                console.log("[CodingAgent] Closing idle sandbox");
                try {
                    await sandboxInstance.kill();
                } catch (e) {
                    // Ignore kill errors
                }
                sandboxInstance = null;
            }
        }, SANDBOX_IDLE_TIMEOUT);
        return sandboxInstance;
    }

    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
        throw new Error("E2B_API_KEY environment variable is not set. Please add it to your .env.local file.");
    }

    console.log("[CodingAgent] Creating new E2B sandbox (this may take 10-30 seconds on first run)...");
    const startTime = Date.now();

    try {
        sandboxInstance = await Sandbox.create({
            apiKey,
            timeoutMs: 60000,  // 60 second timeout for creation
        });

        const elapsed = Date.now() - startTime;
        console.log(`[CodingAgent] Sandbox created successfully in ${elapsed}ms`);
    } catch (error) {
        console.error("[CodingAgent] Failed to create sandbox:", error);
        throw new Error(`Failed to create E2B sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Set idle timeout
    sandboxTimeout = setTimeout(async () => {
        if (sandboxInstance) {
            console.log("[CodingAgent] Closing idle sandbox");
            try {
                await sandboxInstance.kill();
            } catch (e) {
                // Ignore kill errors
            }
            sandboxInstance = null;
        }
    }, SANDBOX_IDLE_TIMEOUT);

    return sandboxInstance;
}

/**
 * Execute with sandbox, with automatic retry if sandbox is stale
 */
async function withSandbox<T>(operation: (sandbox: Sandbox) => Promise<T>): Promise<T> {
    try {
        const sandbox = await getSandbox();
        return await operation(sandbox);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // If sandbox was not found (expired), reset and retry once
        if (errorMessage.includes("not found") || errorMessage.includes("Sandbox") && errorMessage.includes("404")) {
            console.log("[CodingAgent] Sandbox expired, creating a new one...");
            resetSandbox();
            const sandbox = await getSandbox();
            return await operation(sandbox);
        }

        throw error;
    }
}

/**
 * Format execution result
 */
function formatResult(tool: string, output: string, error?: string): string {
    if (error) {
        return `**${tool} Error:**\n\`\`\`\n${error}\n\`\`\``;
    }
    if (!output || output.trim() === "") {
        return `**${tool}:** Executed successfully (no output)`;
    }
    return `**${tool} Output:**\n\`\`\`\n${output}\n\`\`\``;
}

// =============================================================================
// E2B CODING TOOLS
// =============================================================================

/**
 * run_python - Execute Python code
 */
export function createRunPythonTool() {
    return new DynamicStructuredTool({
        name: "run_python",
        description: "Execute Python code in a secure sandbox. Returns stdout/stderr output.",
        schema: z.object({
            code: z.string().describe("Python code to execute"),
        }),
        func: async ({ code }) => {
            try {
                return await withSandbox(async (sandbox) => {
                    console.log("[CodingAgent] Executing Python code...");
                    const result = await sandbox.runCode(code);

                    const stdout = result.logs.stdout.join("\n");
                    const stderr = result.logs.stderr.join("\n");
                    const error = result.error ? `${result.error.name}: ${result.error.value}` : "";

                    if (error) {
                        return formatResult("Python", "", error + (stderr ? `\n${stderr}` : ""));
                    }
                    return formatResult("Python", stdout || stderr);
                });
            } catch (error) {
                return `Error executing Python: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * run_javascript - Execute JavaScript/TypeScript code
 */
export function createRunJavaScriptTool() {
    return new DynamicStructuredTool({
        name: "run_javascript",
        description: "Execute JavaScript or TypeScript code in a secure sandbox.",
        schema: z.object({
            code: z.string().describe("JavaScript or TypeScript code to execute"),
        }),
        func: async ({ code }) => {
            try {
                return await withSandbox(async (sandbox) => {
                    console.log("[CodingAgent] Executing JavaScript code...");
                    const result = await sandbox.runCode(code, { language: "javascript" });

                    const stdout = result.logs.stdout.join("\n");
                    const stderr = result.logs.stderr.join("\n");
                    const error = result.error ? `${result.error.name}: ${result.error.value}` : "";

                    if (error) {
                        return formatResult("JavaScript", "", error + (stderr ? `\n${stderr}` : ""));
                    }
                    return formatResult("JavaScript", stdout || stderr);
                });
            } catch (error) {
                return `Error executing JavaScript: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * run_shell - Execute shell commands
 */
export function createRunShellTool() {
    return new DynamicStructuredTool({
        name: "run_shell",
        description: "Execute shell commands in the sandbox. Use for file operations, system commands, etc.",
        schema: z.object({
            command: z.string().describe("Shell command to execute"),
        }),
        func: async ({ command }) => {
            try {
                return await withSandbox(async (sandbox) => {
                    console.log("[CodingAgent] Executing shell command:", command);
                    const result = await sandbox.commands.run(command);

                    if (result.exitCode !== 0) {
                        return formatResult("Shell", "", result.stderr || `Exit code: ${result.exitCode}`);
                    }
                    return formatResult("Shell", result.stdout);
                });
            } catch (error) {
                return `Error executing shell command: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * write_file - Write content to a file in the sandbox
 */
export function createWriteFileTool() {
    return new DynamicStructuredTool({
        name: "write_file",
        description: "Write content to a file in the sandbox filesystem.",
        schema: z.object({
            path: z.string().describe("File path in the sandbox (e.g., '/home/user/script.py')"),
            content: z.string().describe("Content to write to the file"),
        }),
        func: async ({ path, content }) => {
            try {
                return await withSandbox(async (sandbox) => {
                    console.log("[CodingAgent] Writing file:", path);
                    await sandbox.files.write(path, content);
                    return `**File Written:** Successfully wrote ${content.length} bytes to \`${path}\``;
                });
            } catch (error) {
                return `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * read_file - Read file contents from the sandbox
 */
export function createReadFileTool() {
    return new DynamicStructuredTool({
        name: "read_file",
        description: "Read the contents of a file from the sandbox filesystem.",
        schema: z.object({
            path: z.string().describe("File path in the sandbox to read"),
        }),
        func: async ({ path }) => {
            try {
                return await withSandbox(async (sandbox) => {
                    console.log("[CodingAgent] Reading file:", path);
                    const content = await sandbox.files.read(path);
                    return `**File Contents** (\`${path}\`):\n\`\`\`\n${content}\n\`\`\``;
                });
            } catch (error) {
                return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    });
}

/**
 * Create all Coding Agent tools
 */
export function createAllCodingTools(): DynamicStructuredTool[] {
    return [
        createRunPythonTool(),
        createRunJavaScriptTool(),
        createRunShellTool(),
        createWriteFileTool(),
        createReadFileTool(),
    ];
}
