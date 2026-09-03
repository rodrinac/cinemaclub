#!/usr/bin/env node
/**
 * Determines the next semantic version based on Conventional Commits since the last
 * `vX.Y.Z` release tag, and writes it to package.json and app.json's expo.version.
 *
 * Bump rules (highest wins):
 *   - "BREAKING CHANGE:" in the commit body, or "!" after type/scope (e.g. "feat!:") -> major
 *   - "feat:" / "feat(scope):"                                                       -> minor
 *   - "fix:" / "fix(scope):" (or any other conventional type)                        -> patch
 *
 * Prints the resolved next version to stdout on success, or nothing (exit 0) if no
 * release-worthy commits were found since the last tag.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = process.cwd();
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, "package.json");
const APP_JSON_PATH = path.join(REPO_ROOT, "app.json");

const CONVENTIONAL_COMMIT_PATTERN = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/;
const BREAKING_CHANGE_PATTERN = /^BREAKING CHANGE:\s*/m;

const run = (command, args) =>
  execFileSync(command, args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();

const getLastReleaseTag = () => {
  try {
    return run("git", ["describe", "--tags", "--match", "v[0-9]*.[0-9]*.[0-9]*", "--abbrev=0"]);
  } catch {
    return null;
  }
};

const COMMIT_SEPARATOR = "<<<COMMIT-BOUNDARY>>>";

const getCommitsSince = (tag) => {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const output = run("git", ["log", range, `--format=%B${COMMIT_SEPARATOR}`]);

  if (!output) {
    return [];
  }

  return output
    .split(COMMIT_SEPARATOR)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const classifyBump = (commitMessages) => {
  let bump = null;

  for (const message of commitMessages) {
    const [subject, ...bodyLines] = message.split("\n");
    const body = bodyLines.join("\n");
    const match = CONVENTIONAL_COMMIT_PATTERN.exec(subject.trim());

    if (!match) {
      continue;
    }

    const [, type, , breakingBang] = match;
    const isBreaking = Boolean(breakingBang) || BREAKING_CHANGE_PATTERN.test(body);

    if (isBreaking) {
      return "major";
    }

    if (type === "feat") {
      bump = bump === "major" ? bump : "minor";
      continue;
    }

    if (bump !== "major" && bump !== "minor") {
      bump = "patch";
    }
  }

  return bump;
};

const bumpVersion = (version, bump) => {
  const [major, minor, patch] = version.split(".").map(Number);

  if (bump === "major") {
    return `${major + 1}.0.0`;
  }

  if (bump === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
};

const updateJsonFile = (filePath, updater) => {
  const contents = readFileSync(filePath, "utf8");
  const data = JSON.parse(contents);
  updater(data);
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const main = () => {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const currentVersion = packageJson.version;
  const lastTag = getLastReleaseTag();
  const commitMessages = getCommitsSince(lastTag);
  const bump = classifyBump(commitMessages);

  if (!bump) {
    console.error(
      `No release-worthy Conventional Commits found${lastTag ? ` since ${lastTag}` : ""}; skipping version bump.`,
    );
    process.exit(0);
  }

  const nextVersion = bumpVersion(currentVersion, bump);

  updateJsonFile(PACKAGE_JSON_PATH, (data) => {
    data.version = nextVersion;
  });
  updateJsonFile(APP_JSON_PATH, (data) => {
    data.expo.version = nextVersion;
  });

  console.error(`Bumping version: ${currentVersion} -> ${nextVersion} (${bump})`);
  process.stdout.write(nextVersion);
};

main();
