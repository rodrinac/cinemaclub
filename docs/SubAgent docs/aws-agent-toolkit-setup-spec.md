# AWS Agent Toolkit Setup Spec

## 1. Overview
This specification details the integration of standard AWS Agent Toolkit rules into `AGENTS.md`. It provides the exact upstream rules fetched from the official AWS repository, analyzes the current structure and conventions of `AGENTS.md`, and specifies the exact changes required.

---

## 2. Upstream AWS Agent Rules
Fetched from: `https://raw.githubusercontent.com/aws/agent-toolkit-for-aws/refs/heads/main/rules/aws-agent-rules.md`

```markdown
# AWS Guidance

- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
```

---

## 3. Analysis of Current AGENTS.md

### Structure & Headings
- Top-level Title: `# AGENTS`
- Subtitle: `Quick guidance for contributors/agents.`
- Second-level Headings (`##`):
  - `## Quick start` (contains standard npm scripts)
  - `## Tests` (test commands)
  - `## Refresh README screenshots (live mobile)` (Playwright screenshot command)
  - `## Conventions` (screenshot updates and sample payload conventions)

### Formatting Conventions
- Code snippets use fenced bash code blocks (` ```sh ... ``` `).
- Bullet lists use hyphen `-` prefix.
- Consistent 1 blank line between headings and content blocks.
- Two-level heading hierarchy (`#` for document title, `##` for major sections, `###` for sub-sections).

---

## 4. Integration Strategy

To keep `AGENTS.md` clean and consistent with its existing heading hierarchy:
1. Map the top-level `# AWS Guidance` to `## AWS Guidance` so it sits alongside `## Quick start`, `## Tests`, and `## Conventions`.
2. Map `## Secret Safety` to `### Secret Safety` as a sub-section under `## AWS Guidance`.
3. Append after `## Conventions` separated by an empty line.

### Proposed Content to Append

```markdown
## AWS Guidance

- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

### Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
```

### Exact Git Diff for AGENTS.md

```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -32,3 +32,23 @@
 - Update `showcase/screenshot_01.png`, `showcase/screenshot_02.png`, and `showcase/screenshot_03.png` using Playwright capture only (no manual image edits).
 - Keep the movie-details sample payload in `tests/e2e/fixtures/movie-details.example.json` as the canonical example for docs/tests.
+
+## AWS Guidance
+
+- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
+  execution, observability, and audit logging. If unavailable, use the
+  AWS CLI directly.
+- Before starting a task, check whether a relevant AWS skill is available.
+  Load the skill with `retrieve_skill` and prefer its guidance over
+  general knowledge.
+- When uncertain about specific AWS details (API parameters, permissions,
+  limits, error codes), verify against documentation rather than guessing.
+  State uncertainty explicitly if you cannot confirm.
+- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
+  CloudFormation) over direct CLI commands.
+- When working with infrastructure, follow AWS Well-Architected Framework
+  principles.
+- Do not use em dashes in AWS resource names or descriptions. Use
+  hyphens instead.
+
+### Secret Safety
+
+- MUST load the `aws-secrets-manager` skill first for any secret,
+  credential, API key, token, or password task. MUST NOT call
+  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
+  NOT hit the Secrets Manager Agent daemon directly. MUST use
+  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
+  `asm-exec` so the secret resolves at runtime without entering context.
```
