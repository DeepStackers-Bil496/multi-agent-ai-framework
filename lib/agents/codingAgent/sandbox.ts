import { exec } from "child_process";
import path from "path";

/**
 * Allowed base commands for sandboxed execution.
 */
const ALLOWED_COMMANDS = new Set([
  "npm",
  "pnpm",
  "yarn",
  "npx",
  "node",
  "python",
  "python3",
  "git",
  "make",
  "cargo",
  "go",
  "ls",
  "grep",
  "find",
  "cat",
  "head",
  "tail",
  "diff",
  "wc",
  "tree",
  "echo",
  "pwd",
  "jest",
  "vitest",
  "pytest",
  "eslint",
  "prettier",
  "tsc",
  "mkdir",
  "cp",
  "mv",
  "touch",
  "chmod",
  "sort",
  "uniq",
  "xargs",
  "which",
  "env",
  "printenv",
]);

/**
 * Blocked command patterns that are never allowed.
 */
const BLOCKED_PATTERNS: RegExp[] = [
  /rm\s+(-[^\s]*\s+)*-r\s*f?\s*\//i, // rm -rf /
  /rm\s+(-[^\s]*\s+)*-f\s*r?\s*\//i, // rm -fr /
  /\bsudo\b/i,
  /\bsu\b\s/i,
  /\bchmod\s+777\b/,
  /\bcurl\b.*\|\s*(bash|sh|zsh)\b/i, // curl | bash
  /\bwget\b.*\|\s*(bash|sh|zsh)\b/i,
  />\s*\/dev\/sd/i, // writing to disk devices
  /\bdd\b\s+.*of=/i,
  /\bkill\b\s+-9/i,
  /\bkillall\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bmkfs\b/i,
  /\bformat\b/i,
];

const MAX_OUTPUT_LENGTH = 10_000;

/**
 * Validates a command against the allowlist and blocked patterns.
 * @returns null if valid, error message string if invalid
 */
export function validateCommand(
  command: string,
  workspacePath: string
): string | null {
  const trimmed = command.trim();

  if (!trimmed) {
    return "Empty command";
  }

  // Check blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return `Command blocked by security policy: matches pattern ${pattern}`;
    }
  }

  // Check for path traversal outside workspace
  if (trimmed.includes("../")) {
    // Allow relative paths within workspace, but block attempts to escape
    const resolvedParts = trimmed.match(/\.\.\//g);
    if (resolvedParts && resolvedParts.length > 5) {
      return "Excessive path traversal detected";
    }
  }

  // Extract base command (handle pipes, &&, ;, etc.)
  const segments = trimmed.split(/[|;&]/).map((s) => s.trim());
  for (const segment of segments) {
    if (!segment) continue;
    // Get the first word (the command)
    const baseCommand = segment.split(/\s+/)[0];
    // Strip any path prefix (e.g., ./node_modules/.bin/jest -> jest)
    const commandName = path.basename(baseCommand);

    if (!ALLOWED_COMMANDS.has(commandName)) {
      return `Command '${commandName}' is not in the allowed commands list. Allowed: ${Array.from(ALLOWED_COMMANDS).sort().join(", ")}`;
    }
  }

  return null;
}

/**
 * Executes a command in a sandboxed environment restricted to the workspace directory.
 * @param command The shell command to run
 * @param workspacePath The workspace directory to use as cwd
 * @param timeout Timeout in milliseconds (default 30000)
 * @returns Object with stdout, stderr, and exitCode
 */
export async function executeCommand(
  command: string,
  workspacePath: string,
  timeout = 30_000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Validate command first
  const validationError = validateCommand(command, workspacePath);
  if (validationError) {
    return {
      stdout: "",
      stderr: `Command validation failed: ${validationError}`,
      exitCode: 1,
    };
  }

  // Verify workspace path exists and is within allowed area
  const resolvedWorkspace = path.resolve(workspacePath);
  if (!resolvedWorkspace.startsWith("/tmp/coding-agent-workspaces")) {
    return {
      stdout: "",
      stderr: `Workspace path must be under /tmp/coding-agent-workspaces. Got: ${resolvedWorkspace}`,
      exitCode: 1,
    };
  }

  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: resolvedWorkspace,
        timeout,
        maxBuffer: 1024 * 1024, // 1MB buffer
        env: {
          ...process.env,
          // Restrict HOME to workspace to prevent accessing user config
          HOME: resolvedWorkspace,
        },
      },
      (error, stdout, stderr) => {
        let truncatedStdout = stdout || "";
        let truncatedStderr = stderr || "";

        if (truncatedStdout.length > MAX_OUTPUT_LENGTH) {
          truncatedStdout =
            truncatedStdout.substring(0, MAX_OUTPUT_LENGTH) +
            "\n... [output truncated at 10K chars]";
        }
        if (truncatedStderr.length > MAX_OUTPUT_LENGTH) {
          truncatedStderr =
            truncatedStderr.substring(0, MAX_OUTPUT_LENGTH) +
            "\n... [output truncated at 10K chars]";
        }

        resolve({
          stdout: truncatedStdout,
          stderr: truncatedStderr,
          exitCode: error?.code ?? 0,
        });
      }
    );
  });
}
