---
name: github-personal-cli
description: Use the GitHub CLI with the user's personal GitHub.com account for repository, pull-request, issue, or release work; do not use corporate GitHub hosts.
---

# GitHub Personal CLI

Use this skill for GitHub.com work that must use the user's personal account.

## Account and host

- Explicitly target `github.com`: pass `--hostname github.com` to authentication commands and set `GH_HOST=github.com` for other `gh` commands when the active CLI host could be ambiguous.
- Before a GitHub mutation, verify the personal account with `gh auth status -h github.com`.
- If no valid GitHub.com login exists, run `gh auth login --hostname github.com --web` and wait for the user to approve the browser/device flow. Never request, display, or store a personal access token in a repository or skill file.
- Do not modify, refresh, log out of, or use credentials for any corporate GitHub host.

## Pull requests

- Confirm the current branch, working-tree state, and remote before push or PR creation.
- Push the intended branch, then create the PR with `GH_HOST=github.com gh pr create` and an explicit repository when useful.
- Report the resulting GitHub.com PR URL and validation results. If authentication cannot be completed, provide the GitHub.com compare/new-PR URL instead.
