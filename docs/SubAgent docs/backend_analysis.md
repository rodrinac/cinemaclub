# Terraform & Infrastructure Backend Analysis

## Executive Summary

This document provides a comprehensive technical analysis of the Infrastructure-as-Code (IaC) configuration located in `infra/` for the `cinemaclub` TMDB proxy service. It reviews the current state backend, provider definitions, resource architectures, variables, CI/CD pipeline integration, and highlights critical gaps along with actionable recommendations.

---

## 1. Current State & Backend Configuration

### 1.1 Backend Storage & State Locking
* **Current Backend Type**: Local backend (default).
* **Remote State (S3 / Terraform Cloud / OpenTofu)**: **None configured**. `infra/versions.tf` contains only `required_version` and `required_providers` blocks without a `backend "s3"` or remote block.
* **State Locking (DynamoDB)**: **None configured**. There is no DynamoDB lock table or S3 native locking mechanism configured.
* **State File Behavior in CI/CD**:
  * In `.github/workflows/ci.yml`, Terraform is initialized with `terraform -chdir=infra init -backend=false` for dry-run validation and plan checks.
  * In `.github/workflows/deploy-aws-proxy.yml`, the runner executes `terraform -chdir=infra init` against an ephemeral Ubuntu runner without remote backend configuration parameters. Consequently, any generated `.tfstate` file is discarded upon runner termination.
  * **Impact**: Without a persistent remote state backend, subsequent runs of the deploy pipeline cannot track previously created resources, leading to resource collision errors (e.g., IAM role, Log Group, API Gateway already existing) or untracked orphaned resources.

### 1.2 Environment Separation & Multi-Environment Support
* **Current Structure**: Single flat directory in `infra/`.
* **State Partitioning**: No Terraform workspaces, directory-based environment segregation (`envs/prod`, `envs/staging`), or environment-scoped backend keys exist.
* **Variable-Driven Separation**: Environment differentiation currently relies on runtime variables (`var.api_stage_name`, `var.service_name`, GitHub environment secrets/variables).

---

## 2. Infrastructure Architecture & Configuration in `infra/`

### 2.1 Provider Configuration (`versions.tf`)
* **Terraform Version**: `>= 1.6.0` (compatible with modern Terraform and OpenTofu).
* **Providers**:
  * `hashicorp/aws` (`~> 5.70`, locked to `5.100.0` in `.terraform.lock.hcl`).
  * `hashicorp/archive` (`~> 2.7`, locked to `2.8.0` in `.terraform.lock.hcl`).
* **AWS Provider Settings**:
  * Region driven by `var.aws_region`.
  * Configurable validation bypasses (`skip_credentials_validation`, `skip_metadata_api_check`, `skip_requesting_account_id`) via `var.skip_aws_provider_validation` for credential-less CI plan packaging checks.

### 2.2 Variables & Validation Rules (`variables.tf`, `locals.tf`, `terraform.tfvars.example`)
* **Required Inputs**:
  * `service_name`: Base naming prefix (validated non-blank).
  * `api_stage_name`: API Gateway stage name (e.g., `prod`).
  * `aws_region`: Target deployment region (e.g., `eu-west-1`).
  * `tmdb_secret_arn`: Secrets Manager ARN containing TMDB token (marked `sensitive = true`).
  * `log_retention_days`: CloudWatch log retention period (strictly validated against allowed CloudWatch integer enum values).
* **Optional / Tunable Inputs**:
  * `cors_allow_origin`: Single exact origin or `null` to disable CORS. Validated against comma-separated multi-origin misconfigurations.
  * `rate_limit_rps` & `rate_limit_burst`: Token-bucket rate limiting values. Enforced pairwise consistency via `check "rate_limit_pair"`.
  * `lambda_memory_size`: Memory allocation (128–10240 MB, default 256 MB).
  * `lambda_timeout_seconds`: Timeout ceiling (1–10 s, default 10 s).
  * `cache_max_entries`: In-memory LRU cache size (default 100).
  * `alarm_*`: Thresholds and SNS notification target for CloudWatch alarms.
  * `tags`: Map of resource tags applied globally.
* **Naming & Derived Locals (`locals.tf`)**:
  * `name_prefix = "${var.service_name}-${var.api_stage_name}"` (sanitized with regex).
  * Enforces maximum character lengths (e.g. Lambda name <= 64 chars, REST API name <= 128 chars).

### 2.3 Resource Breakdown

| File | Resources / Components | Description |
| :--- | :--- | :--- |
| **`iam.tf`** | `aws_iam_role.lambda`<br>`aws_iam_role_policy.lambda_permissions`<br>`aws_iam_role.apigateway_logs`<br>`aws_api_gateway_account.this` | Least-privilege execution roles for Lambda (Logs + SecretsManager read) and API Gateway CloudWatch push. |
| **`lambda.tf`** | `aws_lambda_function.tmdb_proxy`<br>`aws_cloudwatch_log_group.lambda`<br>`aws_cloudwatch_log_group.api_access`<br>`aws_cloudwatch_log_group.api_execution`<br>`data.archive_file.lambda` | Node.js 22.x runtime packaging `server/` directory into zip artifact. Configures env vars and dedicated log groups. |
| **`api-gateway.tf`** | `aws_api_gateway_rest_api.tmdb_proxy`<br>`aws_api_gateway_resource.proxy`<br>`aws_api_gateway_method.*`<br>`aws_api_gateway_integration.*`<br>`aws_api_gateway_deployment.tmdb_proxy`<br>`aws_api_gateway_stage.tmdb_proxy`<br>`aws_api_gateway_method_settings.all_methods`<br>`aws_api_gateway_gateway_response.*` | Regional REST API with `{proxy+}` greedy path and root fallback routing to Lambda via `AWS_PROXY`. Handles custom error responses, access logging, and throttling. |
| **`alarms.tf`** | `aws_cloudwatch_metric_alarm.lambda_errors`<br>`aws_cloudwatch_metric_alarm.lambda_throttles`<br>`aws_cloudwatch_metric_alarm.lambda_duration`<br>`aws_cloudwatch_metric_alarm.api_gateway_5xx` | Conditional CloudWatch alarms with configurable thresholds routed to SNS topic if provided. |
| **`outputs.tf`** | `stage_invoke_url`<br>`movies_api_base_url`<br>`rest_api_id`, `stage_name`<br>`lambda_function_name`, `*_log_group_name`<br>`alarm_names` | Essential endpoints, resource IDs, and log group names for application integration and post-deploy validation. |

---

## 3. Gaps & Risk Analysis

1. **State Loss in Automated Deployments (High Severity)**:
   * CI/CD triggers `terraform apply` on GitHub Actions without remote backend state persistence.
   * Every deployment run creates state in a transient container filesystem that disappears when the workflow finishes.
2. **Concurrency & Race Conditions (Medium Severity)**:
   * Without distributed locking (DynamoDB or S3 state locking), multiple concurrent workflow runs or local runs could corrupt state or conflict on AWS resource provisioning.
3. **No Drift Detection / Plan Review Workflow (Low-Medium Severity)**:
   * Deployment workflow combines `plan` and `apply` in a single run without PR-level plan output or remote state comparison.
4. **Environment Isolation (Low Severity)**:
   * If multiple stages (e.g. `dev`, `staging`, `prod`) are deployed to the same AWS account, naming prefixes prevent resource collisions, but state keys must be separated when remote state is enabled.

---

## 4. Recommendations

### 4.1 Remote S3 Backend with State Locking
Add an S3 backend configuration with DynamoDB locking. To allow flexible configuration across local development and CI/CD pipelines, use partial configuration in `infra/versions.tf`:

```hcl
terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    # Partial configuration: bucket, key, region, dynamodb_table
    # supplied via backend config file or CLI arguments
  }

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}
```

### 4.2 Backend Configuration Strategy
1. **Bootstrap State Infrastructure**:
   * S3 Bucket: `cinemaclub-terraform-state-<account_id>-<region>` with SSE (AES256 or KMS), versioning enabled, and public access blocked.
   * DynamoDB Table: `cinemaclub-terraform-locks` with partition key `LockID` (string).
2. **Backend Configuration Files**:
   Create environment-specific `.hcl` backend configs (e.g. `infra/backend-prod.hcl`):
   ```hcl
   bucket         = "cinemaclub-terraform-state-prod"
   key            = "tmdb-proxy/terraform.tfstate"
   region         = "eu-west-1"
   dynamodb_table = "cinemaclub-terraform-locks"
   encrypt        = true
   ```
3. **Pipeline Initialization**:
   Update `.github/workflows/deploy-aws-proxy.yml`:
   ```sh
   terraform -chdir=infra init -backend-config="bucket=${{ vars.TF_STATE_BUCKET }}" \
                               -backend-config="key=${{ vars.TF_STATE_KEY }}" \
                               -backend-config="region=${{ vars.AWS_REGION }}" \
                               -backend-config="dynamodb_table=${{ vars.TF_LOCK_TABLE }}"
   ```

### 4.3 Summary Table of Recommendations

| Category | Finding | Proposed Solution |
| :--- | :--- | :--- |
| **State Storage** | Ephemeral local state in CI runners | S3 remote backend with server-side encryption & bucket versioning |
| **State Locking** | No lock mechanism | DynamoDB state locking table |
| **Multi-Environment** | Shared configuration paths | Environment-specific state keys or backend config files (`backend-*.hcl`) |
| **Validation in CI** | `init -backend=false` used in CI check | Maintain `init -backend=false` for dry linting; pass backend parameters during deploy |
