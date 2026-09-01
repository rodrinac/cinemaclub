# Skill File Specification

## Scope

This document specifies the analysis for creating the skill file at the exact path `.github/skills/github-personal-cli/SKILL.md`.

## Repository State Check

- Ran `git --no-pager status --short --untracked-files=all` to avoid overwriting unrelated work.
- Existing unrelated changes were present before this spec work, including tracked modifications and untracked files. No existing project files were modified by this analysis except this spec document.

## Directory Existence and Status

- `.github`: exists and is a directory.
- `.github/skills`: does not exist.
- `.claude`: does not exist.
- `.claude/skills`: does not exist.

## Exact Target Path

- Target skill file: `.github/skills/github-personal-cli/SKILL.md`

## Parent Directories Required

To create the target file, the following parent-directory state is required:

1. `.github` already exists, so it does **not** need creation.
2. `.github/skills` does **not** exist and would need creation.
3. `.github/skills/github-personal-cli` does **not** exist and would need creation.
4. The file `.github/skills/github-personal-cli/SKILL.md` should then be created inside that final directory.

## Notes on `.claude/skills`

- `.claude/skills` does not exist.
- Based on the requested target path, `.claude/skills` is **not** the location to create for this task.
- No `.claude`-side directories are required for the requested file.

## Verbatim User-Supplied `SKILL.md` Content

```md
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
```
