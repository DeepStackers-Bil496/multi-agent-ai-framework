import { DynamicStructuredTool } from "@langchain/core/tools";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { createCodebaseAgentTools } from "../codebaseAgent/tools";
import {
  createCreateBranchTool,
  createCreateOrUpdateFileTool,
  createGetFileContentsTool,
  createListBranchesTool,
  createListCommitsTool,
  createPushFilesTool,
  createSearchCodeTool,
} from "../githubAgent/tools";
import { executeCommand, validateCommand } from "./sandbox";

// ---------------------------------------------------------------------------
// Workspace context — tracks the currently active repository
// ---------------------------------------------------------------------------
interface WorkspaceContext {
  owner: string;
  repo: string;
  localPath: string | null;
  branch: string;
}

let currentWorkspace: WorkspaceContext | null = null;

const WORKSPACE_ROOT = "/tmp/coding-agent-workspaces";

function getWorkspacePath(owner: string, repo: string): string {
  return path.join(WORKSPACE_ROOT, `${owner}--${repo}`);
}

// ---------------------------------------------------------------------------
// Helper: get GitHub PAT from runtime secrets or env
// ---------------------------------------------------------------------------
let _runtimeSecretsRef: Record<string, string> | undefined;

function getGitHubPAT(): string | undefined {
  return _runtimeSecretsRef?.["GITHUB_PAT"] || process.env.GITHUB_PAT;
}

// ==========================================================================
// TOOL DEFINITIONS
// ==========================================================================

// --- A. Repository Management ---

function createListUserReposTool() {
  return new DynamicStructuredTool({
    name: "list_user_repos",
    description:
      "List the authenticated user's GitHub repositories, sorted by most recently updated.",
    schema: z.object({
      perPage: z
        .number()
        .optional()
        .describe("Number of repos to return (default 30, max 100)"),
    }),
    func: async ({ perPage }) => {
      const pat = getGitHubPAT();
      if (!pat) {
        return "Error: GITHUB_PAT is not configured. Set it in agent settings or environment variables.";
      }
      try {
        const response = await fetch(
          `https://api.github.com/user/repos?sort=updated&per_page=${perPage || 30}`,
          {
            headers: {
              Authorization: `Bearer ${pat.trim()}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );
        if (!response.ok) {
          return `GitHub API error: ${response.status} ${response.statusText}`;
        }
        const repos = await response.json();
        const simplified = repos.map(
          (r: any) =>
            `- **${r.full_name}** (${r.private ? "private" : "public"}) — ${r.language || "N/A"} — ${r.description || "No description"}`
        );
        return `**Your Repositories (${repos.length}):**\n\n${simplified.join("\n")}`;
      } catch (error) {
        return `Error listing repos: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

function createGetRepoStructureTool() {
  return new DynamicStructuredTool({
    name: "get_repo_structure",
    description:
      "Get the full file tree of a GitHub repository. Useful for understanding project structure.",
    schema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      branch: z
        .string()
        .optional()
        .describe("Branch name (defaults to repo default branch)"),
    }),
    func: async ({ owner, repo, branch }) => {
      const pat = getGitHubPAT();
      if (!pat) {
        return "Error: GITHUB_PAT is not configured.";
      }
      try {
        const ref = branch || "HEAD";
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
          {
            headers: {
              Authorization: `Bearer ${pat.trim()}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );
        if (!response.ok) {
          return `GitHub API error: ${response.status} ${response.statusText}`;
        }
        const data = await response.json();
        if (!data.tree) {
          return "No file tree found.";
        }
        // Build tree view
        const lines = data.tree
          .filter((item: any) => item.type === "blob")
          .map((item: any) => item.path);

        // Truncate if too large
        const MAX_LINES = 500;
        if (lines.length > MAX_LINES) {
          return `**Repository: ${owner}/${repo}** (${lines.length} files, showing first ${MAX_LINES})\n\n\`\`\`\n${lines.slice(0, MAX_LINES).join("\n")}\n... and ${lines.length - MAX_LINES} more files\n\`\`\``;
        }
        return `**Repository: ${owner}/${repo}** (${lines.length} files)\n\n\`\`\`\n${lines.join("\n")}\n\`\`\``;
      } catch (error) {
        return `Error getting repo structure: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

function createCloneRepositoryTool() {
  return new DynamicStructuredTool({
    name: "clone_repository",
    description:
      "Clone a GitHub repository to a local workspace for file editing and command execution. Required before running commands or making local file changes.",
    schema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      branch: z
        .string()
        .optional()
        .describe("Branch to clone (defaults to default branch)"),
    }),
    func: async ({ owner, repo, branch }) => {
      const pat = getGitHubPAT();
      if (!pat) {
        return "Error: GITHUB_PAT is not configured.";
      }
      const workspacePath = getWorkspacePath(owner, repo);

      try {
        // Create workspace root if needed
        await fs.mkdir(WORKSPACE_ROOT, { recursive: true });

        // Check if already cloned
        try {
          await fs.access(path.join(workspacePath, ".git"));
          // Already exists, pull latest
          const branchArg = branch ? `git checkout ${branch} && ` : "";
          return new Promise<string>((resolve) => {
            exec(
              `cd "${workspacePath}" && ${branchArg}git pull`,
              { timeout: 60_000 },
              (error, stdout, stderr) => {
                currentWorkspace = {
                  owner,
                  repo,
                  localPath: workspacePath,
                  branch: branch || "main",
                };
                if (error) {
                  resolve(
                    `Repository already cloned at ${workspacePath}. Pull had issues: ${stderr || error.message}`
                  );
                } else {
                  resolve(
                    `Repository already cloned. Updated to latest:\n${stdout}`
                  );
                }
              }
            );
          });
        } catch {
          // Not cloned yet, proceed with clone
        }

        const cloneUrl = `https://${pat.trim()}@github.com/${owner}/${repo}.git`;
        const branchArg = branch ? `--branch ${branch} ` : "";
        const cmd = `git clone ${branchArg}--depth 50 "${cloneUrl}" "${workspacePath}"`;

        return new Promise<string>((resolve) => {
          exec(cmd, { timeout: 120_000 }, (error, stdout, stderr) => {
            if (error) {
              resolve(`Error cloning repository: ${stderr || error.message}`);
              return;
            }
            currentWorkspace = {
              owner,
              repo,
              localPath: workspacePath,
              branch: branch || "main",
            };
            resolve(
              `Successfully cloned ${owner}/${repo} to ${workspacePath}.\nReady for file operations and command execution.`
            );
          });
        });
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

function createSetActiveRepositoryTool() {
  return new DynamicStructuredTool({
    name: "set_active_repository",
    description:
      "Set the active repository context for remote operations (reading files, browsing structure) without cloning.",
    schema: z.object({
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      branch: z
        .string()
        .optional()
        .describe("Branch name (defaults to 'main')"),
    }),
    func: async ({ owner, repo, branch }) => {
      // Check if local clone exists
      const workspacePath = getWorkspacePath(owner, repo);
      let localPath: string | null = null;
      try {
        await fs.access(path.join(workspacePath, ".git"));
        localPath = workspacePath;
      } catch {
        // No local clone
      }

      currentWorkspace = {
        owner,
        repo,
        localPath,
        branch: branch || "main",
      };
      return `Active repository set to ${owner}/${repo} (branch: ${currentWorkspace.branch})${localPath ? " — local clone available" : " — remote mode"}`;
    },
  });
}

// --- B. File Operations (local + remote) ---

function createReadFileTool() {
  return new DynamicStructuredTool({
    name: "read_file",
    description:
      "Read the contents of a file from the active repository. Uses local clone if available, otherwise reads from GitHub.",
    schema: z.object({
      filePath: z
        .string()
        .describe("Path to the file relative to the repository root"),
      owner: z
        .string()
        .optional()
        .describe("Repository owner (optional if active repository is set)"),
      repo: z
        .string()
        .optional()
        .describe("Repository name (optional if active repository is set)"),
    }),
    func: async ({ filePath, owner, repo }) => {
      const effectiveOwner = owner || currentWorkspace?.owner;
      const effectiveRepo = repo || currentWorkspace?.repo;

      if (!effectiveOwner || !effectiveRepo) {
        return "Error: No active repository. Use set_active_repository or clone_repository first, or provide owner and repo parameters.";
      }

      // Try local first
      if (currentWorkspace?.localPath) {
        try {
          const fullPath = path.join(currentWorkspace.localPath, filePath);
          // Security: ensure path is within workspace
          const resolvedPath = path.resolve(fullPath);
          if (
            !resolvedPath.startsWith(path.resolve(currentWorkspace.localPath))
          ) {
            return "Error: Path traversal detected. File must be within the repository.";
          }
          const content = await fs.readFile(resolvedPath, "utf-8");
          const ext = path.extname(filePath).slice(1);
          return `**File: ${filePath}**\n\n\`\`\`${ext}\n${content}\n\`\`\``;
        } catch {
          // Fall through to remote
        }
      }

      // Remote: use GitHub MCP tool
      const mcpTool = createGetFileContentsTool();
      return mcpTool.invoke({
        owner: effectiveOwner,
        repo: effectiveRepo,
        path: filePath,
        ref: currentWorkspace?.branch,
      });
    },
  });
}

function createWriteFileTool() {
  return new DynamicStructuredTool({
    name: "write_file",
    description:
      "Write or update a file in the repository. Uses local filesystem if cloned, otherwise commits directly to GitHub.",
    schema: z.object({
      filePath: z
        .string()
        .describe("Path to the file relative to the repository root"),
      content: z.string().describe("The full file content to write"),
      commitMessage: z
        .string()
        .optional()
        .describe("Commit message (required for remote writes)"),
      owner: z.string().optional().describe("Repository owner"),
      repo: z.string().optional().describe("Repository name"),
    }),
    func: async ({ filePath, content, commitMessage, owner, repo }) => {
      const effectiveOwner = owner || currentWorkspace?.owner;
      const effectiveRepo = repo || currentWorkspace?.repo;

      if (!effectiveOwner || !effectiveRepo) {
        return "Error: No active repository. Use set_active_repository or clone_repository first.";
      }

      // Local write
      if (currentWorkspace?.localPath) {
        try {
          const fullPath = path.join(currentWorkspace.localPath, filePath);
          const resolvedPath = path.resolve(fullPath);
          if (
            !resolvedPath.startsWith(path.resolve(currentWorkspace.localPath))
          ) {
            return "Error: Path traversal detected.";
          }
          // Ensure directory exists
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
          await fs.writeFile(resolvedPath, content, "utf-8");
          return `Successfully wrote ${content.length} characters to ${filePath}`;
        } catch (error) {
          return `Error writing file locally: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      }

      // Remote: use GitHub MCP tool
      const mcpTool = createCreateOrUpdateFileTool();
      return mcpTool.invoke({
        owner: effectiveOwner,
        repo: effectiveRepo,
        path: filePath,
        content,
        message: commitMessage || `Update ${filePath}`,
        branch: currentWorkspace?.branch || "main",
      });
    },
  });
}

function createListDirectoryTool() {
  return new DynamicStructuredTool({
    name: "list_directory",
    description:
      "List files and directories at a path in the active repository.",
    schema: z.object({
      dirPath: z
        .string()
        .optional()
        .describe(
          "Directory path relative to repo root (defaults to root '.')"
        ),
      owner: z.string().optional().describe("Repository owner"),
      repo: z.string().optional().describe("Repository name"),
    }),
    func: async ({ dirPath, owner, repo }) => {
      const effectiveOwner = owner || currentWorkspace?.owner;
      const effectiveRepo = repo || currentWorkspace?.repo;
      const targetPath = dirPath || ".";

      if (!effectiveOwner || !effectiveRepo) {
        return "Error: No active repository set.";
      }

      // Local
      if (currentWorkspace?.localPath) {
        try {
          const fullPath = path.join(currentWorkspace.localPath, targetPath);
          const resolvedPath = path.resolve(fullPath);
          if (
            !resolvedPath.startsWith(path.resolve(currentWorkspace.localPath))
          ) {
            return "Error: Path traversal detected.";
          }
          const entries = await fs.readdir(resolvedPath, {
            withFileTypes: true,
          });
          const items = entries.map((e) =>
            e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`
          );
          return `**Directory: ${targetPath}**\n\n${items.join("\n")}`;
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      }

      // Remote
      const mcpTool = createGetFileContentsTool();
      return mcpTool.invoke({
        owner: effectiveOwner,
        repo: effectiveRepo,
        path: targetPath,
        ref: currentWorkspace?.branch,
      });
    },
  });
}

function createSearchCodeInRepoTool() {
  return new DynamicStructuredTool({
    name: "search_code_in_repo",
    description:
      "Search for code patterns in the active repository. Uses local grep if cloned, otherwise GitHub code search.",
    schema: z.object({
      query: z
        .string()
        .describe("Search query / pattern to look for in the code"),
      filePattern: z
        .string()
        .optional()
        .describe("File glob pattern to filter (e.g. '*.ts', '*.py')"),
      owner: z.string().optional().describe("Repository owner"),
      repo: z.string().optional().describe("Repository name"),
    }),
    func: async ({ query, filePattern, owner, repo }) => {
      const effectiveOwner = owner || currentWorkspace?.owner;
      const effectiveRepo = repo || currentWorkspace?.repo;

      if (!effectiveOwner || !effectiveRepo) {
        return "Error: No active repository set.";
      }

      // Local grep
      if (currentWorkspace?.localPath) {
        const includeArg = filePattern ? `--include="${filePattern}"` : "";
        const cmd = `grep -rn ${includeArg} "${query}" . | head -100`;
        const result = await executeCommand(
          cmd,
          currentWorkspace.localPath,
          15_000
        );
        if (result.exitCode !== 0 && !result.stdout) {
          return `No matches found for "${query}"${filePattern ? ` in ${filePattern} files` : ""}.`;
        }
        return `**Search results for "${query}":**\n\n\`\`\`\n${result.stdout}\n\`\`\``;
      }

      // Remote
      const mcpTool = createSearchCodeTool();
      const searchQuery = `${query} repo:${effectiveOwner}/${effectiveRepo}`;
      return mcpTool.invoke({ query: searchQuery, perPage: 20 });
    },
  });
}

// --- C. Terminal/Execution (local only) ---

function createRunCommandTool() {
  return new DynamicStructuredTool({
    name: "run_command",
    description:
      "Run a shell command in the cloned repository workspace. Commands are sandboxed — only approved commands (npm, pnpm, git, node, python, etc.) are allowed. Requires repository to be cloned first.",
    schema: z.object({
      command: z.string().describe("The shell command to execute"),
      timeout: z
        .number()
        .optional()
        .describe("Timeout in milliseconds (default 30000, max 120000)"),
    }),
    func: async ({ command, timeout }) => {
      if (!currentWorkspace?.localPath) {
        return "Error: No local clone available. Use clone_repository first to clone the repo before running commands.";
      }

      const effectiveTimeout = Math.min(timeout || 30_000, 120_000);
      const result = await executeCommand(
        command,
        currentWorkspace.localPath,
        effectiveTimeout
      );

      let output = "";
      if (result.stdout)
        output += `**stdout:**\n\`\`\`\n${result.stdout}\n\`\`\`\n`;
      if (result.stderr)
        output += `**stderr:**\n\`\`\`\n${result.stderr}\n\`\`\`\n`;
      output += `**Exit code:** ${result.exitCode}`;
      return output;
    },
  });
}

function createRunTestsTool() {
  return new DynamicStructuredTool({
    name: "run_tests",
    description:
      "Detect and run the test suite for the cloned repository. Automatically detects the test framework (jest, vitest, pytest, etc.).",
    schema: z.object({
      testPath: z
        .string()
        .optional()
        .describe("Specific test file or directory to run"),
    }),
    func: async ({ testPath }) => {
      if (!currentWorkspace?.localPath) {
        return "Error: No local clone available. Use clone_repository first.";
      }

      const ws = currentWorkspace.localPath;

      // Detect test framework
      let testCommand = "";
      try {
        const pkgJson = JSON.parse(
          await fs.readFile(path.join(ws, "package.json"), "utf-8")
        );
        const scripts = pkgJson.scripts || {};
        const devDeps = pkgJson.devDependencies || {};
        const deps = pkgJson.dependencies || {};

        if (scripts.test) {
          testCommand = `npm test${testPath ? ` -- ${testPath}` : ""}`;
        } else if (devDeps.vitest || deps.vitest) {
          testCommand = `npx vitest run${testPath ? ` ${testPath}` : ""}`;
        } else if (devDeps.jest || deps.jest) {
          testCommand = `npx jest${testPath ? ` ${testPath}` : ""}`;
        }
      } catch {
        // Not a Node project
      }

      if (!testCommand) {
        // Check for Python
        try {
          await fs.access(path.join(ws, "pytest.ini"));
          testCommand = `pytest${testPath ? ` ${testPath}` : ""}`;
        } catch {
          try {
            await fs.access(path.join(ws, "setup.py"));
            testCommand = `python -m pytest${testPath ? ` ${testPath}` : ""}`;
          } catch {
            // Check for pyproject.toml
            try {
              await fs.access(path.join(ws, "pyproject.toml"));
              testCommand = `pytest${testPath ? ` ${testPath}` : ""}`;
            } catch {
              return "Could not detect test framework. Use run_command to run tests manually.";
            }
          }
        }
      }

      const result = await executeCommand(testCommand, ws, 120_000);
      let output = `**Running:** \`${testCommand}\`\n\n`;
      if (result.stdout) output += `\`\`\`\n${result.stdout}\n\`\`\`\n`;
      if (result.stderr)
        output += `**stderr:**\n\`\`\`\n${result.stderr}\n\`\`\`\n`;
      output += `**Exit code:** ${result.exitCode}`;
      return output;
    },
  });
}

// --- D. Git Operations (local) ---

function createGitStatusTool() {
  return new DynamicStructuredTool({
    name: "git_status",
    description:
      "Show the git status of the cloned repository workspace (modified, staged, untracked files).",
    schema: z.object({}),
    func: async () => {
      if (!currentWorkspace?.localPath) {
        return "Error: No local clone available.";
      }
      const result = await executeCommand(
        "git status",
        currentWorkspace.localPath
      );
      return `\`\`\`\n${result.stdout}\n\`\`\`${result.stderr ? `\n\nstderr: ${result.stderr}` : ""}`;
    },
  });
}

function createGitDiffTool() {
  return new DynamicStructuredTool({
    name: "git_diff",
    description:
      "Show the git diff of uncommitted changes in the cloned repository.",
    schema: z.object({
      staged: z
        .boolean()
        .optional()
        .describe("Show staged changes (default: unstaged)"),
      filePath: z.string().optional().describe("Specific file to diff"),
    }),
    func: async ({ staged, filePath }) => {
      if (!currentWorkspace?.localPath) {
        return "Error: No local clone available.";
      }
      const stagedArg = staged ? "--staged " : "";
      const fileArg = filePath ? ` -- ${filePath}` : "";
      const result = await executeCommand(
        `git diff ${stagedArg}${fileArg}`,
        currentWorkspace.localPath
      );
      if (!result.stdout.trim()) {
        return "No changes detected.";
      }
      return `\`\`\`diff\n${result.stdout}\n\`\`\``;
    },
  });
}

function createGitLogTool() {
  return new DynamicStructuredTool({
    name: "git_log",
    description: "Show recent git commit history for the cloned repository.",
    schema: z.object({
      count: z
        .number()
        .optional()
        .describe("Number of commits to show (default 10)"),
    }),
    func: async ({ count }) => {
      if (!currentWorkspace?.localPath) {
        return "Error: No local clone available.";
      }
      const n = count || 10;
      const result = await executeCommand(
        `git log --oneline -${n}`,
        currentWorkspace.localPath
      );
      return `**Recent commits:**\n\`\`\`\n${result.stdout}\n\`\`\``;
    },
  });
}

function createCommitChangesTool() {
  return new DynamicStructuredTool({
    name: "commit_changes",
    description:
      "Stage all changes and create a git commit in the cloned repository.",
    schema: z.object({
      message: z.string().describe("Commit message"),
      files: z
        .array(z.string())
        .optional()
        .describe(
          "Specific files to stage (defaults to all changes with 'git add .')"
        ),
    }),
    func: async ({ message, files }) => {
      if (!currentWorkspace?.localPath) {
        return "Error: No local clone available.";
      }
      const ws = currentWorkspace.localPath;
      const addCmd =
        files && files.length > 0
          ? `git add ${files.map((f) => `"${f}"`).join(" ")}`
          : "git add .";

      const addResult = await executeCommand(addCmd, ws);
      if (addResult.exitCode !== 0) {
        return `Error staging files: ${addResult.stderr}`;
      }

      const commitResult = await executeCommand(
        `git commit -m "${message.replace(/"/g, '\\"')}"`,
        ws
      );
      if (commitResult.exitCode !== 0) {
        return `Error committing: ${commitResult.stderr || commitResult.stdout}`;
      }
      return `**Commit created:**\n${commitResult.stdout}`;
    },
  });
}

function createPushChangesTool() {
  return new DynamicStructuredTool({
    name: "push_changes",
    description: "Push local commits to the remote GitHub repository.",
    schema: z.object({
      branch: z
        .string()
        .optional()
        .describe("Branch to push (defaults to current branch)"),
      setUpstream: z
        .boolean()
        .optional()
        .describe("Set upstream tracking (for new branches)"),
    }),
    func: async ({ branch, setUpstream }) => {
      if (!currentWorkspace?.localPath) {
        return "Error: No local clone available.";
      }
      const branchArg = branch || "";
      const upstreamArg = setUpstream ? "-u origin " : "";
      const result = await executeCommand(
        `git push ${upstreamArg}${branchArg}`,
        currentWorkspace.localPath,
        60_000
      );
      if (result.exitCode !== 0) {
        return `Error pushing: ${result.stderr}`;
      }
      return `**Push successful:**\n${result.stdout || result.stderr}`;
    },
  });
}

function createCreatePullRequestTool() {
  return new DynamicStructuredTool({
    name: "create_pull_request",
    description: "Create a pull request on GitHub from the current branch.",
    schema: z.object({
      title: z.string().describe("PR title"),
      body: z.string().optional().describe("PR description/body"),
      base: z
        .string()
        .optional()
        .describe("Base branch to merge into (defaults to 'main')"),
      head: z
        .string()
        .optional()
        .describe("Head branch (defaults to current branch)"),
      owner: z.string().optional().describe("Repository owner"),
      repo: z.string().optional().describe("Repository name"),
    }),
    func: async ({ title, body, base, head, owner, repo }) => {
      const effectiveOwner = owner || currentWorkspace?.owner;
      const effectiveRepo = repo || currentWorkspace?.repo;
      if (!effectiveOwner || !effectiveRepo) {
        return "Error: No active repository.";
      }
      const pat = getGitHubPAT();
      if (!pat) {
        return "Error: GITHUB_PAT is not configured.";
      }

      // Get current branch if head not specified
      let headBranch = head;
      if (!headBranch && currentWorkspace?.localPath) {
        const result = await executeCommand(
          "git rev-parse --abbrev-ref HEAD",
          currentWorkspace.localPath
        );
        headBranch = result.stdout.trim();
      }
      if (!headBranch) {
        return "Error: Could not determine head branch. Specify the 'head' parameter.";
      }

      try {
        const response = await fetch(
          `https://api.github.com/repos/${effectiveOwner}/${effectiveRepo}/pulls`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${pat.trim()}`,
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
              title,
              body: body || "",
              head: headBranch,
              base: base || "main",
            }),
          }
        );
        if (!response.ok) {
          const err = await response.json();
          return `Error creating PR: ${response.status} — ${JSON.stringify(err)}`;
        }
        const pr = await response.json();
        return `**Pull Request created:** #${pr.number}\n**URL:** ${pr.html_url}\n**Title:** ${pr.title}`;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
  });
}

// --- E. Git operations via MCP (remote) ---

function createRemoteCreateBranchTool() {
  return new DynamicStructuredTool({
    name: "create_branch_remote",
    description:
      "Create a new branch on GitHub remotely (without needing a local clone).",
    schema: z.object({
      owner: z.string().optional().describe("Repository owner"),
      repo: z.string().optional().describe("Repository name"),
      branch: z.string().describe("Name for the new branch"),
      from_branch: z
        .string()
        .optional()
        .describe("Source branch (defaults to default branch)"),
    }),
    func: async ({ owner, repo, branch, from_branch }) => {
      const effectiveOwner = owner || currentWorkspace?.owner;
      const effectiveRepo = repo || currentWorkspace?.repo;
      if (!effectiveOwner || !effectiveRepo) {
        return "Error: No active repository set.";
      }
      const mcpTool = createCreateBranchTool();
      return mcpTool.invoke({
        owner: effectiveOwner,
        repo: effectiveRepo,
        branch,
        from_branch,
      });
    },
  });
}

// ==========================================================================
// MAIN EXPORT
// ==========================================================================

/**
 * Create the full CodingAgent tool suite.
 * @param runtimeSecrets Optional runtime secrets from user configuration
 */
export function createCodingAgentTools(
  runtimeSecrets?: Record<string, string>
): DynamicStructuredTool[] {
  // Store secrets for tools that need them
  _runtimeSecretsRef = runtimeSecrets;

  return [
    // Repository Management
    createListUserReposTool(),
    createGetRepoStructureTool(),
    createCloneRepositoryTool(),
    createSetActiveRepositoryTool(),

    // File Operations
    createReadFileTool(),
    createWriteFileTool(),
    createListDirectoryTool(),
    createSearchCodeInRepoTool(),

    // Terminal/Execution
    createRunCommandTool(),
    createRunTestsTool(),

    // Git Operations (local)
    createGitStatusTool(),
    createGitDiffTool(),
    createGitLogTool(),
    createCommitChangesTool(),
    createPushChangesTool(),
    createCreatePullRequestTool(),
    createRemoteCreateBranchTool(),

    // Code Analysis (reuse from CodebaseAgent)
    ...createCodebaseAgentTools(),
  ];
}
