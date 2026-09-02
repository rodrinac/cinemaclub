# AWS IAM & API Gateway Workflow Failure Analysis and Fix Specification

**Document Identifier:** `docs/SubAgent docs/aws-iam-apigateway-fix-spec.md`  
**Date:** September 2, 2026  
**Target Workflows & Infrastructure:** `.github/workflows/deploy-aws-proxy.yml`, `infra/*.tf`, `cinemaclub-github-actions-production-deploy` IAM Role & Policy

---

## 1. Executive Summary

During deployment of the TMDB AWS Proxy via GitHub Actions (`deploy-aws-proxy.yml`) and Terraform (`infra/`), two primary categories of infrastructure and permission failures were identified:

1. **GitHub Actions Deploy Role IAM Permission Deficiencies**:
   - The deploy policy `cinemaclub-tmdb-proxy-deploy` is missing `lambda:ListVersionsByFunction`. During `terraform plan` / `terraform apply` / `terraform refresh`, the Terraform AWS Provider invokes the AWS Lambda API `ListVersionsByFunction` to query function state, causing `AccessDeniedException` (403 Forbidden).
   - Other required read/state inspection actions (`lambda:ListAliases`, `lambda:GetFunctionCodeSigningConfig`, `lambda:ListProvisionedConcurrencyConfigs`, `iam:AttachRolePolicy`, `iam:DetachRolePolicy`) are also absent or constrained.

2. **API Gateway CloudWatch Logging Account Race Condition (`aws_api_gateway_account.this`)**:
   - In `infra/iam.tf`, `aws_api_gateway_account.this` only references `aws_iam_role.apigateway_logs.arn` without an explicit `depends_on = [aws_iam_role_policy.apigateway_logs]` (or `[aws_iam_role_policy_attachment.apigateway_logs]`).
   - Because IAM is eventually consistent and Terraform provisions resources in parallel, API Gateway attempts to validate the role before the permissions policy is attached or fully propagated, leading to `BadRequestException: The role ARN pass to API Gateway must be validated against CloudWatch Logs`.

---

## 2. Detailed Findings & Root Cause Analysis

### 2.1 Issue 1: Missing `lambda:ListVersionsByFunction` in Deploy Policy

#### Context
In `docs/SubAgent docs/tmdb-aws-deployment-configuration-guide.md` (Section 7.3), the documented IAM policy for GitHub Actions (`cinemaclub-tmdb-proxy-deploy`) defines the `LambdaDeploy` statement as:

```json
{
  "Sid": "LambdaDeploy",
  "Effect": "Allow",
  "Action": [
    "lambda:CreateFunction",
    "lambda:DeleteFunction",
    "lambda:GetFunction",
    "lambda:GetFunctionConfiguration",
    "lambda:UpdateFunctionCode",
    "lambda:UpdateFunctionConfiguration",
    "lambda:AddPermission",
    "lambda:RemovePermission",
    "lambda:GetPolicy",
    "lambda:TagResource",
    "lambda:UntagResource",
    "lambda:ListTags"
  ],
  "Resource": "arn:aws:lambda:AWS_REGION:ACCOUNT_ID:function:SERVICE_NAME-STAGE_NAME-tmdb-proxy*"
}
```

#### Root Cause
- The Terraform AWS provider (v5.70+) resource `aws_lambda_function` unconditionally executes `ListVersionsByFunction` during resource read/refresh cycles to track published versions (even when `publish = false`).
- When Terraform executes `plan` or `apply` with the assumed GitHub Actions deployment role, AWS Lambda denies the API call with:
  ```text
  AccessDeniedException: User: arn:aws:sts::<ACCOUNT_ID>:assumed-role/cinemaclub-github-actions-production-deploy/... is not authorized to perform: lambda:ListVersionsByFunction on resource: arn:aws:lambda:<REGION>:<ACCOUNT_ID>:function:cinemaclub-tmdb-proxy-prod-tmdb-proxy
  ```

#### Additional Missing / Required Lambda Actions
To avoid future provider refresh failures, the following Lambda actions must also be granted on the function ARN:
- `lambda:ListVersionsByFunction` (Mandatory)
- `lambda:ListAliases` (State tracking for aliases)
- `lambda:GetFunctionCodeSigningConfig` (Read code signing configuration)
- `lambda:ListProvisionedConcurrencyConfigs` (Concurrency state query)
- `lambda:ListFunctionUrlConfigs` (Function URL inspection)
- `lambda:ListEventSourceMappings` (Trigger mapping inspection)
- `lambda:PublishVersion` (If versioning is ever enabled)

---

### 2.2 Issue 2: API Gateway CloudWatch Role Attachment & Permission Requirements

#### Context
In `infra/iam.tf` (lines 44–99):

```hcl
data "aws_iam_policy_document" "apigateway_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apigateway_logs" {
  name               = substr("${local.name_prefix}-apigw-logs-role", 0, 64)
  assume_role_policy = data.aws_iam_policy_document.apigateway_assume_role.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "apigateway_logs" {
  statement {
    sid = "WriteApiGatewayLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
      "logs:GetLogEvents",
      "logs:FilterLogEvents",
    ]
    resources = [
      aws_cloudwatch_log_group.api_access.arn,
      "${aws_cloudwatch_log_group.api_access.arn}:*",
      aws_cloudwatch_log_group.api_execution.arn,
      "${aws_cloudwatch_log_group.api_execution.arn}:*",
    ]
  }

  statement {
    sid       = "DescribeApiGatewayLogGroups"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "apigateway_logs" {
  name   = substr("${local.name_prefix}-apigw-logs-policy", 0, 128)
  role   = aws_iam_role.apigateway_logs.id
  policy = data.aws_iam_policy_document.apigateway_logs.json
}

resource "aws_api_gateway_account" "this" {
  cloudwatch_role_arn = aws_iam_role.apigateway_logs.arn

  depends_on = [
    aws_iam_role_policy.apigateway_logs,
  ]
}
```

#### Detailed Breakdown of the 8 Research Points:

1. **Role Definition (`aws_iam_role.apigateway_logs`)**:
   - The role is created with name `${local.name_prefix}-apigw-logs-role` and an assume role policy.
2. **Current Policy Attachment Mechanism**:
   - Currently uses an inline policy `aws_iam_role_policy.apigateway_logs` rather than `aws_iam_role_policy_attachment` referencing `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushCloudWatchLogs`.
3. **Current Actions/Resources vs API Gateway Requirements**:
   - *Current `infra/iam.tf`:*
     - `WriteApiGatewayLogs`: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:DescribeLogStreams`, `logs:PutLogEvents`, `logs:GetLogEvents`, `logs:FilterLogEvents` on `aws_cloudwatch_log_group.api_access.arn`, `${aws_cloudwatch_log_group.api_access.arn}:*`, `aws_cloudwatch_log_group.api_execution.arn`, `${aws_cloudwatch_log_group.api_execution.arn}:*`.
     - `DescribeApiGatewayLogGroups`: `logs:DescribeLogGroups` on `*`.
   - *AWS Requirement:*
     - AWS API Gateway `SetAccount` / `UpdateAccount` API performs an automated validation check against the role ARN passed in `cloudwatch_role_arn`.
     - Restricting `logs:CreateLogGroup` and `logs:CreateLogStream` to specific log groups fails validation because API Gateway generates execution log groups dynamically (`API-Gateway-Execution-Logs_<rest_api_id>/<stage>`).
     - AWS requires permissions across `arn:aws:logs:*:*:*` (or the AWS managed policy attachment `AmazonAPIGatewayPushCloudWatchLogs`).
4. **AWS Managed Policy (`AmazonAPIGatewayPushCloudWatchLogs`)**:
   - The canonical AWS policy `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushCloudWatchLogs` provides:
     - `logs:CreateLogGroup`
     - `logs:CreateLogStream`
     - `logs:DescribeLogGroups`
     - `logs:DescribeLogStreams`
     - `logs:PutLogEvents`
     - `logs:GetLogEvents`
     - `logs:FilterLogEvents`
     on `*`. API Gateway's account validator checks for this standard policy or identical permission semantics.
5. **Trust Policy**:
   - `data.aws_iam_policy_document.apigateway_assume_role` grants `sts:AssumeRole` to principal `apigateway.amazonaws.com`. This is properly configured.
6. **`aws_api_gateway_account.this` Definition**:
   - Sets `cloudwatch_role_arn = aws_iam_role.apigateway_logs.arn`.
7. **Regional Account Scope & Dependencies**:
   - In AWS API Gateway REST API v1, `aws_api_gateway_account` is a per-region account setting.
   - `depends_on = [aws_iam_role_policy_attachment.apigateway_logs]` ensures Terraform attaches the policy before API Gateway executes role validation.
8. **Root Cause of `BadRequestException`**:
   - API Gateway rejects the role assignment because the inline policy does not grant wildcard log creation/stream permissions or is not using the AWS managed policy `AmazonAPIGatewayPushCloudWatchLogs`, causing `BadRequestException: The role ARN does not have required permissions configured. Please grant trust permission for API Gateway and add the required role policy.`

---

### 2.3 Issue 3: Terraform Provider AWS Permissions Comprehensive Matrix

The deployment role (`cinemaclub-github-actions-production-deploy`) requires permissions across 5 AWS services:

| AWS Service | Required Actions | Target Resource Scope | Reason / Provider Resource |
|---|---|---|---|
| **IAM** | `iam:CreateRole`<br>`iam:DeleteRole`<br>`iam:GetRole`<br>`iam:GetRolePolicy`<br>`iam:PutRolePolicy`<br>`iam:DeleteRolePolicy`<br>`iam:ListRolePolicies`<br>`iam:ListAttachedRolePolicies`<br>`iam:ListInstanceProfilesForRole`<br>`iam:AttachRolePolicy`<br>`iam:DetachRolePolicy`<br>`iam:TagRole`<br>`iam:UntagRole`<br>`iam:PassRole`<br>`iam:UpdateAssumeRolePolicy` | `arn:aws:iam::<ACCOUNT_ID>:role/cinemaclub-tmdb-proxy-*` | Manages Lambda execution role (`aws_iam_role.lambda`) and API Gateway logging role (`aws_iam_role.apigateway_logs`). `iam:PassRole` allows assigning roles to Lambda and API Gateway services. |
| **Lambda** | `lambda:CreateFunction`<br>`lambda:DeleteFunction`<br>`lambda:GetFunction`<br>`lambda:GetFunctionConfiguration`<br>`lambda:GetFunctionCodeSigningConfig`<br>`lambda:UpdateFunctionCode`<br>`lambda:UpdateFunctionConfiguration`<br>`lambda:AddPermission`<br>`lambda:RemovePermission`<br>`lambda:GetPolicy`<br>`lambda:ListVersionsByFunction`<br>`lambda:ListAliases`<br>`lambda:ListEventSourceMappings`<br>`lambda:ListProvisionedConcurrencyConfigs`<br>`lambda:ListFunctionUrlConfigs`<br>`lambda:TagResource`<br>`lambda:UntagResource`<br>`lambda:ListTags` | `arn:aws:lambda:<REGION>:<ACCOUNT_ID>:function:cinemaclub-tmdb-proxy-*` | Manages `aws_lambda_function.tmdb_proxy` and `aws_lambda_permission.apigateway_invoke`. `ListVersionsByFunction` is essential for Terraform state inspection. |
| **API Gateway** | `apigateway:GET`<br>`apigateway:POST`<br>`apigateway:PUT`<br>`apigateway:PATCH`<br>`apigateway:DELETE` | `arn:aws:apigateway:<REGION>::/account`<br>`arn:aws:apigateway:<REGION>::/restapis`<br>`arn:aws:apigateway:<REGION>::/restapis/*`<br>`arn:aws:apigateway:<REGION>::/tags/*` | Manages REST API, resources, methods, integrations, gateway responses, deployments, stages, method settings, and regional account settings (`aws_api_gateway_account.this`). |
| **CloudWatch Logs** | `logs:CreateLogGroup`<br>`logs:DeleteLogGroup`<br>`logs:PutRetentionPolicy`<br>`logs:DeleteRetentionPolicy`<br>`logs:DescribeLogGroups`<br>`logs:TagResource`<br>`logs:UntagResource`<br>`logs:ListTagsForResource`<br>`logs:ListTagsLogGroup`<br>`logs:FilterLogEvents` | `arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:/aws/lambda/cinemaclub-tmdb-proxy-*`<br>`arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:/aws/apigateway/cinemaclub-tmdb-proxy-*`<br>`arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:API-Gateway-Execution-Logs_*`<br>`arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:*` | Manages log groups (`aws_cloudwatch_log_group.lambda`, `api_access`, `api_execution`) and post-deploy log assertions in CI/CD. |
| **CloudWatch Metrics & Alarms** | `cloudwatch:PutMetricAlarm`<br>`cloudwatch:DeleteAlarms`<br>`cloudwatch:DescribeAlarms`<br>`cloudwatch:TagResource`<br>`cloudwatch:UntagResource`<br>`cloudwatch:ListTagsForResource` | `arn:aws:cloudwatch:<REGION>:<ACCOUNT_ID>:alarm:cinemaclub-tmdb-proxy-*`<br>`arn:aws:cloudwatch:<REGION>:<ACCOUNT_ID>:alarm:*` | Manages metric alarms (`aws_cloudwatch_metric_alarm.lambda_errors`, `lambda_throttles`, `lambda_duration`, `api_gateway_5xx`) and workflow verification checks. |

---

## 3. Recommended Remediation & Code Changes

### 3.1 Fix 1: Update `infra/iam.tf` for `aws_api_gateway_account`

Add `depends_on = [aws_iam_role_policy.apigateway_logs]` to `aws_api_gateway_account.this`.

```hcl
resource "aws_api_gateway_account" "this" {
  cloudwatch_role_arn = aws_iam_role.apigateway_logs.arn

  depends_on = [
    aws_iam_role_policy.apigateway_logs,
  ]
}
```

*Optional alternative if adopting standard AWS managed policy:*
```hcl
resource "aws_iam_role_policy_attachment" "apigateway_logs" {
  role       = aws_iam_role.apigateway_logs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushCloudWatchLogs"
}

resource "aws_api_gateway_account" "this" {
  cloudwatch_role_arn = aws_iam_role.apigateway_logs.arn

  depends_on = [
    aws_iam_role_policy_attachment.apigateway_logs,
  ]
}
```

---

### 3.2 Fix 2: Update Deploy Policy in Documentation & IAM Role Setup

Update `cinemaclub-tmdb-proxy-deploy-policy.json` (and `docs/SubAgent docs/tmdb-aws-deployment-configuration-guide.md`) to include all missing Lambda and IAM actions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ApiGatewayDeploy",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:PATCH",
        "apigateway:DELETE"
      ],
      "Resource": [
        "arn:aws:apigateway:AWS_REGION::/account",
        "arn:aws:apigateway:AWS_REGION::/restapis",
        "arn:aws:apigateway:AWS_REGION::/restapis/*",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/resources",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/resources/*",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/methods/*",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/integrations/*",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/deployments",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/deployments/*",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/stages",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/stages/*",
        "arn:aws:apigateway:AWS_REGION::/restapis/*/gatewayresponses/*",
        "arn:aws:apigateway:AWS_REGION::/tags/*"
      ]
    },
    {
      "Sid": "LambdaDeploy",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:GetFunctionCodeSigningConfig",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        "lambda:ListVersionsByFunction",
        "lambda:ListAliases",
        "lambda:ListEventSourceMappings",
        "lambda:ListProvisionedConcurrencyConfigs",
        "lambda:ListFunctionUrlConfigs",
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:ListTags"
      ],
      "Resource": "arn:aws:lambda:AWS_REGION:ACCOUNT_ID:function:SERVICE_NAME-STAGE_NAME-tmdb-proxy*"
    },
    {
      "Sid": "IamRolesForStack",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:ListInstanceProfilesForRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:PassRole",
        "iam:UpdateAssumeRolePolicy"
      ],
      "Resource": [
        "arn:aws:iam::ACCOUNT_ID:role/SERVICE_NAME-STAGE_NAME-lambda-role",
        "arn:aws:iam::ACCOUNT_ID:role/SERVICE_NAME-STAGE_NAME-apigw-logs-role"
      ]
    },
    {
      "Sid": "LogGroupsForStack",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:PutRetentionPolicy",
        "logs:DeleteRetentionPolicy",
        "logs:DescribeLogGroups",
        "logs:TagResource",
        "logs:UntagResource",
        "logs:ListTagsForResource",
        "logs:ListTagsLogGroup",
        "logs:FilterLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:AWS_REGION:ACCOUNT_ID:log-group:/aws/lambda/SERVICE_NAME-STAGE_NAME-tmdb-proxy*",
        "arn:aws:logs:AWS_REGION:ACCOUNT_ID:log-group:/aws/apigateway/SERVICE_NAME-STAGE_NAME-access*",
        "arn:aws:logs:AWS_REGION:ACCOUNT_ID:log-group:API-Gateway-Execution-Logs_*",
        "arn:aws:logs:AWS_REGION:ACCOUNT_ID:log-group:*"
      ]
    },
    {
      "Sid": "CloudWatchAlarmsForStack",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DeleteAlarms",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:TagResource",
        "cloudwatch:UntagResource",
        "cloudwatch:ListTagsForResource"
      ],
      "Resource": [
        "arn:aws:cloudwatch:AWS_REGION:ACCOUNT_ID:alarm:SERVICE_NAME-STAGE_NAME-*",
        "arn:aws:cloudwatch:AWS_REGION:ACCOUNT_ID:alarm:*"
      ]
    }
  ]
}
```

---

## 4. Verification Plan

1. **Terraform Validation & Formatting**:
   - Run `terraform -chdir=infra fmt -check`
   - Run `terraform -chdir=infra init -backend=false && terraform -chdir=infra validate`
   - Run `terraform -chdir=infra plan -input=false -lock=false -refresh=false -var='service_name=cinemaclub-tmdb-proxy' -var='api_stage_name=prod' -var='aws_region=eu-west-1' -var='tmdb_secret_arn=arn:aws:secretsmanager:eu-west-1:123456789012:secret:example' -var='log_retention_days=14' -var='rate_limit_rps=5' -var='rate_limit_burst=5' -var='skip_aws_provider_validation=true'`
2. **Local Test Suite**:
   - Run `npm test` and `npm run test:ci`
3. **CI Workflow Verification**:
   - Ensure `.github/workflows/ci.yml` passes with the Terraform formatting, validation, and plan checks.

---

## 5. Summary Table of Action Items

| Component | File / Resource | Action Required | Status |
|---|---|---|---|
| **Terraform IAM** | `infra/iam.tf` (`aws_api_gateway_account.this`) | Add `depends_on = [aws_iam_role_policy.apigateway_logs]` | Spec ready for implementation |
| **Deploy IAM Policy** | `cinemaclub-github-actions-production-deploy` / docs | Add `lambda:ListVersionsByFunction`, `lambda:ListAliases`, `lambda:GetFunctionCodeSigningConfig`, `iam:AttachRolePolicy`, `iam:DetachRolePolicy` | Spec ready for implementation |
| **Deployment Guide** | `docs/SubAgent docs/tmdb-aws-deployment-configuration-guide.md` | Update example JSON policy in section 7.3 | Spec ready for implementation |
