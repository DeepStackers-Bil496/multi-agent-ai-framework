# Git Commands Reference

## Quick notes

- Commands assume you're in a repository (a directory with a `.git` folder).
- Example layout: clone -> work -> stage -> commit -> share -> maintain.
- Replace placeholders like <branch>, <file>, <commit> with your values.

---

git config --global user.email "you@example.com"
git config --global core.editor "code --wait"  # or vim/nano
git config --list
git config user.email  # repo-local
## Setup and identity

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global core.editor "code --wait"  # or vim/nano

# View config:
git config --list
git config user.email  # repo-local

# Generate SSH key (if needed):
ssh-keygen -t ed25519 -C "you@example.com"
ssh-add ~/.ssh/id_ed25519
```

---

git init  # creates .git and initializes repo
git clone <repo-url> [directory]
git clone --depth 1 <repo-url>
## Creating and cloning repositories

```bash
# Initialize a new repo:
git init  # creates .git and initializes repo

# Clone an existing repo:
git clone <repo-url> [directory]

# Clone shallow (history limited):
git clone --depth 1 <repo-url>
```

---

git branch            # local
git branch -r         # remote
git branch -a         # all
git branch <branch>
git switch <branch>
git switch -c <new-branch>  # create + switch
git checkout -b <new-branch>
git status
git branch -m <old> <new>
git branch -d <branch>   # safe delete (refuse unmerged)
git branch -D <branch>   # force delete
## Branching and navigation

```bash
# List branches:
git branch            # local
git branch -r         # remote
git branch -a         # all

# Create a branch:
git branch <branch>

# Switch branches (modern):
git switch <branch>
git switch -c <new-branch>  # create + switch

# Legacy checkout:
git checkout -b <new-branch>

# Show current branch and status:
git status

# Rename branch (local):
git branch -m <old> <new>

# Delete branch:
git branch -d <branch>   # safe delete (refuse unmerged)
git branch -D <branch>   # force delete
```

---

git add <file>
git add .               # stage everything (careful)
git add -p              # interactive patch staging
git commit -m "Short message"
git commit -am "Message"
git add <forgotten-file>
git commit --amend --no-edit  # add file to previous commit without changing message
git commit --amend -m "New message"
git restore --staged <file>
git restore <file>
## Making changes: add, commit, amend

```bash
# Stage files for commit:
git add <file>
git add .               # stage everything (careful)
git add -p              # interactive patch staging

# Commit staged changes:
git commit -m "Short message"

# Commit with all tracked changes (skip explicit add):
git commit -am "Message"

# Amend last commit (useful to change message or add missed files):
git add <forgotten-file>
git commit --amend --no-edit  # add file to previous commit without changing message
git commit --amend -m "New message"

# Undo staged file (move from staged back to working tree):
git restore --staged <file>

# Undo working-tree changes (discard local edits):
git restore <file>
```

---

git log --oneline --graph --decorate --all
git log --follow -- <file>
git diff            # unstaged changes
git diff --staged   # staged vs HEAD
git show <commit>
git log --grep="fix bug"
git blame <file>
## Viewing history and diffs

```bash
# Show commit history (one line):
git log --oneline --graph --decorate --all

# Full log for file:
git log --follow -- <file>

# Show changes between working tree and index:
git diff            # unstaged changes
git diff --staged   # staged vs HEAD

# Show changes for a commit:
git show <commit>

# Search commit messages:
git log --grep="fix bug"

# Blame (who last changed each line):
git blame <file>
```

---

git remote add origin <repo-url>
git remote -v
git fetch <remote>
git pull <remote> <branch>
git pull --rebase <remote> <branch>  # rebase local changes on top of remote
git push <remote> <branch>
git push -u origin <branch>  # set upstream (default for future pushes)
git tag v1.0.0
git push origin --tags
git push origin --delete <branch>
## Remote repositories and sharing

```bash
# Add a remote:
git remote add origin <repo-url>

# Show remotes:
git remote -v

# Fetch from remote (no merge):
git fetch <remote>

# Pull (fetch + merge):
git pull <remote> <branch>
git pull --rebase <remote> <branch>  # rebase local changes on top of remote

# Push branch to remote:
git push <remote> <branch>
git push -u origin <branch>  # set upstream (default for future pushes)

# Push tags:
git tag v1.0.0
git push origin --tags

# Remove remote branch:
git push origin --delete <branch>
```

---

git tag
git tag -a v1.0.0 -m "Release 1.0.0"
git tag v1.0.1
git show v1.0.0
git push origin v1.0.0
## Tags

```bash
# List tags:
git tag

# Create annotated tag:
git tag -a v1.0.0 -m "Release 1.0.0"

# Create lightweight tag:
git tag v1.0.1

# Show tag details:
git show v1.0.0

# Push a single tag:
git push origin v1.0.0
```

---

git merge <branch>
git merge --no-ff <branch>
git rebase <branch>
git rebase -i <base-commit>
git rebase --abort
git rebase --continue
git rebase --abort
## Merging and rebasing

```bash
# Merge a branch into current:
git merge <branch>

# Merge with no-fast-forward (force merge commit):
git merge --no-ff <branch>

# Rebase current branch onto another:
git rebase <branch>

# Interactive rebase to rewrite commits:
git rebase -i <base-commit>

# Abort rebase if something goes wrong:
git rebase --abort

# Continue rebase after resolving conflicts:
git rebase --continue

# If rebase leaves you in a bad state, return to original with:
git rebase --abort
```

---

git stash push -m "WIP: feature X"
git stash            # shorthand
git stash list
git stash apply stash@{0}
git stash pop
git stash drop stash@{0}
git stash clear
## Stashing and temporary shelve

```bash
# Save working state:
git stash push -m "WIP: feature X"
git stash            # shorthand

# List stashes:
git stash list

# Apply stash (keep in stash):
git stash apply stash@{0}

# Pop stash (apply + drop):
git stash pop

# Drop stash:
git stash drop stash@{0}

# Clear all stashes:
git stash clear
```

---

git reset --soft <commit>   # keep changes staged
git reset --mixed <commit>  # default, keep changes in working dir
git reset --hard <commit>   # discard working tree and index (danger)
git revert <commit>
git cherry-pick <commit>
git reflog
git branch recovered <sha>
## Undoing commits and history edits

```bash
# Reset (move HEAD):
git reset --soft <commit>   # keep changes staged
git reset --mixed <commit>  # default, keep changes in working dir
git reset --hard <commit>   # discard working tree and index (danger)

# Revert a commit (create new commit that undoes it):
git revert <commit>

# Cherry-pick a commit onto current branch:
git cherry-pick <commit>

# Show reflog (recover lost commits):
git reflog

# Recover a lost branch/commit example:
git branch recovered <sha>
```

---

git checkout -b feature/awesome
git commit -m "Add initial work for awesome feature"
git push -u origin feature/awesome
## Collaboration workflows & best practices

```text
- Use feature branches: create a branch per feature or fix.
- Keep commits small and atomic; write meaningful commit messages.
- Rebase locally to keep history clean, but avoid rebasing public/shared branches.
- Use pull requests (GitHub/GitLab) for reviews before merging.

# Example typical flow:
git checkout -b feature/awesome
...work...
git add -p
git commit -m "Add initial work for awesome feature"
git push -u origin feature/awesome
create pull request on hosting service
```

---

git cat-file -p <sha>
git ls-tree -r <commit>
git sparse-checkout init --cone
git sparse-checkout set path/to/dir
git worktree add ../repo-worktree <branch>
echo "#!/bin/sh\n# simple lint\nexit 0" > .git/hooks/pre-commit
## Advanced: plumbing and misc

```bash
# Show object info:
git cat-file -p <sha>

# List files in a commit:
git ls-tree -r <commit>

# Sparse checkout (subset of files):
git sparse-checkout init --cone
git sparse-checkout set path/to/dir

# Worktrees (multiple working dirs from one repo):
git worktree add ../repo-worktree <branch>

# Set up a hook (example pre-commit):
mkdir -p .git/hooks
echo "#!/bin/sh\n# simple lint\nexit 0" > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

---

git rebase -i origin/main  # mark commits as squash/fixup
git pull --rebase origin <branch>
git push
git log origin/<branch>..<branch>
## Troubleshooting common situations

```bash
# I accidentally committed sensitive data — steps:
# 1. Remove it from history: git filter-branch or git filter-repo (recommended)
# 2. Invalidate exposed secrets (rotate keys)

# I want to squash multiple commits before pushing:
git rebase -i origin/main  # mark commits as squash/fixup

# My push was rejected (non-fast-forward):
git pull --rebase origin <branch>
# resolve conflicts
git push

# I want to see what will be pushed:
git log origin/<branch>..<branch>
```

---

git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.lg "log --oneline --graph --decorate --all"
## Useful aliases (local config)

```bash
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.lg "log --oneline --graph --decorate --all"
```

---

## Short reference (commands grouped)

```text
- setup: git config, ssh-keygen
- init/clone: git init, git clone
- status/inspect: git status, git diff, git log, git show, git blame
- stage/commit: git add, git commit, git commit --amend
- branches: git branch, git switch, git merge, git rebase
- remote: git remote, git fetch, git pull, git push
- tags: git tag, git push --tags
- stash: git stash
- undo: git revert, git reset, git reflog
```

---

## Learning resources

- Official book: https://git-scm.com/book/en/v2
- Official docs: https://git-scm.com/docs
- Interactive tutorial: https://learngitbranching.js.org/

---

If you want, I can:
- expand any section into step-by-step tutorials
- add examples tailored to GitHub/GitLab/Gitea
- include suggested commit message templates and PR checklist

\n
