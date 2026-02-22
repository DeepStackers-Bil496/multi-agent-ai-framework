import { auth } from "@/app/(auth)/auth";
import { getSecret, resolveAgentConfig } from "@/lib/agents/configResolver";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  // Get GitHub PAT from user's agent config or environment
  const resolvedConfig = await resolveAgentConfig(
    session.user.id,
    "coding-agent"
  );
  const githubPat = getSecret(resolvedConfig, "GITHUB_PAT", "GITHUB_PAT");

  if (!githubPat) {
    return Response.json(
      {
        error:
          "GITHUB_PAT is not configured. Set it in Coding Agent settings or as an environment variable.",
        repos: [],
      },
      { status: 200 }
    );
  }

  try {
    const response = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=50&type=all",
      {
        headers: {
          Authorization: `Bearer ${githubPat.trim()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      return Response.json(
        {
          error: `GitHub API error: ${response.status} ${response.statusText}`,
          repos: [],
        },
        { status: 200 }
      );
    }

    const repos = await response.json();

    const simplified = repos.map((r: any) => ({
      full_name: r.full_name,
      name: r.name,
      owner: r.owner?.login,
      description: r.description,
      language: r.language,
      default_branch: r.default_branch,
      private: r.private,
      updated_at: r.updated_at,
    }));

    return Response.json({ repos: simplified });
  } catch (error) {
    return Response.json(
      {
        error: `Failed to fetch repositories: ${error instanceof Error ? error.message : "Unknown error"}`,
        repos: [],
      },
      { status: 200 }
    );
  }
}
