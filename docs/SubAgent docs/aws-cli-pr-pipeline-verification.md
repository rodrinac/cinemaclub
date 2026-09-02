# AWS CLI / PR Pipeline Verification

## Scope

Reviewed the repository's GitHub Actions workflows and related configuration for AWS CLI installation and pull-request pipeline availability:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-aws-proxy.yml`
- `.github/dependabot.yml`
- `package.json`

## Findings

### Pull-request CI (`.github/workflows/ci.yml`)

- The workflow runs on `pull_request` for `master` and `main` (lines 3–7) on `ubuntu-latest`.
- It explicitly installs Node.js 24, Terraform 1.11.4, and npm dependencies (lines 20–32).
- Its Terraform plan check sets dummy AWS credentials and region, then uses `skip_aws_provider_validation=true` (lines 55–69). This avoids requiring live AWS access.
- No step installs AWS CLI, invokes `aws --version`, or otherwise verifies the CLI.
- The PR workflow therefore has no repository-controlled AWS CLI installation or availability guarantee. It may work because GitHub-hosted Ubuntu images commonly include AWS CLI, but that is an implicit runner-image dependency and is not validated by this workflow.
- The PR workflow does not currently execute any `aws` command; its AWS-related validation is Terraform-only.

### AWS deployment workflow (`.github/workflows/deploy-aws-proxy.yml`)

- This workflow is not a PR pipeline: it triggers on manual dispatch and selected pushes to `master`/`main` (lines 3–11).
- It configures credentials with `aws-actions/configure-aws-credentials@v4` (lines 52–56), but that action supplies credentials and region; it is not an AWS CLI installation step.
- Later steps directly invoke `aws` for API Gateway, CloudWatch Logs, and CloudWatch alarms verification (lines 136–167).
- No explicit AWS CLI setup action or installation command is present. This workflow likewise relies on the `ubuntu-latest` runner image for the CLI binary.

### Related configuration

- `package.json` contains no AWS CLI package or installation script; its `install` dependency is an unrelated npm package.
- `.github/dependabot.yml` only manages npm dependencies and does not manage GitHub Actions or AWS CLI tooling.

## Conclusion

AWS CLI is **not explicitly installed** by either workflow. It is likely available on GitHub's current `ubuntu-latest` image, so the deployment workflow may run successfully today, but availability is not guaranteed by repository configuration. The PR pipeline itself neither installs nor checks AWS CLI and does not use it. If PR validation is expected to exercise AWS CLI commands, the workflow should add an explicit CLI setup/install step and a version check before those commands; otherwise, document that AWS CLI is intentionally outside PR CI scope.

## Verification notes

Static verification performed by inspecting all workflow/config references to AWS, pull requests, setup actions, and install commands. No implementation changes were made. The document path was verified after creation.
