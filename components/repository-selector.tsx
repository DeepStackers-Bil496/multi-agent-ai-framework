"use client";

import { GitBranch, Lock, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { cn, fetcher } from "@/lib/utils";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export interface SelectedRepository {
  owner: string;
  repo: string;
  branch?: string;
}

interface RepoData {
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

interface ReposResponse {
  repos: RepoData[];
  error?: string;
}

function PureRepositorySelector({
  selectedRepository,
  onRepoSelect,
  compact = false,
}: {
  selectedRepository: SelectedRepository | null;
  onRepoSelect: (repo: SelectedRepository | null) => void;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useSWR<ReposResponse>(
    isOpen || selectedRepository ? "/api/coding-agent/repos" : null,
    fetcher
  );

  const repos = data?.repos || [];

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos;
    const q = searchQuery.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.language?.toLowerCase().includes(q)
    );
  }, [repos, searchQuery]);

  const handleSelect = useCallback(
    (repo: RepoData) => {
      const selected = {
        owner: repo.owner,
        repo: repo.name,
        branch: repo.default_branch,
      };
      console.log(
        "[RepositorySelector] Selected repo:",
        JSON.stringify(selected)
      );
      onRepoSelect(selected);
      setIsOpen(false);
      setSearchQuery("");
    },
    [onRepoSelect]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRepoSelect(null);
    },
    [onRepoSelect]
  );

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Language color mapping
  const langColors: Record<string, string> = useMemo(
    () => ({
      TypeScript: "bg-blue-500",
      JavaScript: "bg-yellow-400",
      Python: "bg-green-500",
      Rust: "bg-orange-600",
      Go: "bg-cyan-500",
      Java: "bg-red-500",
      Ruby: "bg-red-600",
      C: "bg-gray-500",
      "C++": "bg-pink-500",
      "C#": "bg-purple-500",
      Swift: "bg-orange-400",
      Kotlin: "bg-purple-400",
      PHP: "bg-indigo-400",
      Shell: "bg-green-400",
      HTML: "bg-orange-500",
      CSS: "bg-purple-300",
    }),
    []
  );

  if (compact && selectedRepository) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs">
        <GitBranch className="h-3 w-3 text-muted-foreground" />
        <span className="max-w-[180px] truncate font-medium">
          {selectedRepository.owner}/{selectedRepository.repo}
        </span>
        {selectedRepository.branch && (
          <span className="text-muted-foreground">
            :{selectedRepository.branch}
          </span>
        )}
        <button
          className="ml-1 text-muted-foreground hover:text-foreground"
          onClick={handleClear}
          type="button"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {isOpen ? (
        <div className="rounded-lg border bg-popover shadow-md">
          {/* Search input */}
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search repositories..."
              ref={inputRef}
              value={searchQuery}
            />
          </div>

          {/* Repo list */}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : data?.error ? (
              <p className="py-4 text-center text-muted-foreground text-sm">
                {data.error}
              </p>
            ) : filteredRepos.length === 0 ? (
              <p className="py-4 text-center text-muted-foreground text-sm">
                No repositories found.
              </p>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  key={repo.full_name}
                  onClick={() => handleSelect(repo)}
                  type="button"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-sm">
                        {repo.full_name}
                      </span>
                      {repo.private && (
                        <Lock className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    {repo.description && (
                      <span className="truncate text-muted-foreground text-xs">
                        {repo.description}
                      </span>
                    )}
                  </div>
                  {repo.language && (
                    <div className="flex items-center gap-1 text-muted-foreground text-xs">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          langColors[repo.language] || "bg-gray-400"
                        )}
                      />
                      {repo.language}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <Button
          className={cn(
            "w-full justify-start gap-2 text-left font-normal",
            !selectedRepository && "text-muted-foreground"
          )}
          onClick={() => setIsOpen(true)}
          size="sm"
          variant="outline"
        >
          <GitBranch className="h-4 w-4" />
          {selectedRepository ? (
            <span className="truncate">
              {selectedRepository.owner}/{selectedRepository.repo}
            </span>
          ) : (
            "Select a repository..."
          )}
        </Button>
      )}
    </div>
  );
}

export const RepositorySelector = memo(PureRepositorySelector);
