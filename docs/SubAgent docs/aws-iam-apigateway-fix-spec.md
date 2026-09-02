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

2. **API Gateway CloudWatch Logging Role & Account Setting Misconfiguration**:
   - In `infra/iam.tf`, the managed policy ARN was incorrectly specified as `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushCloudWatchLogs` (missing `To`), whereas the exact canonical AWS Managed Policy ARN is **`arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`** (PascalCase with `PushToCloudWatchLogs`).
   - In `infra/iam.tf`, `aws_api_gateway_account.this` must explicitly depend on `aws_iam_role_policy_attachment.apigateway_logs` via `depends_on` to prevent eventual consistency race conditions where API Gateway validates the role before permissions are attached.

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

#### Context & AWS Canonical Policy Specification
AWS API Gateway requires an IAM role with specific permissions to write execution and access logs to Amazon CloudWatch. 

- **Exact AWS Managed Policy Name:** `AmazonAPIGatewayPushToCloudWatchLogs`
- **Exact AWS Managed Policy ARN:**  
  `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`  
  *(Note: Must include `To` in `PushToCloudWatchLogs` — omitting `To` as in `PushCloudWatchLogs` will cause AWS API `NoSuchEntity` or 404 error).*

#### Policy Definition Contents
The managed policy `AmazonAPIGatewayPushToCloudWatchLogs` grants:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:PutLogEvents",
        "logs:GetLogEvents",
        "logs:FilterLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

#### Trust Relationship
The IAM role must trust the API Gateway service principal:
- **Service Principal:** `apigateway.amazonaws.com`
- **Action:** `sts:AssumeRole`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

#### Account-Level Setting (`aws_api_gateway_account`)
- API Gateway CloudWatch logging is configured globally per AWS account and per region via the API Gateway Account resource (`/account`).
- When setting `cloudwatch_role_arn`, API Gateway performs an automated validation check against CloudWatch. If the IAM policy is not yet attached or propagated, API Gateway rejects the call with:
  ```text
  BadRequestException: The role ARN pass to API Gateway must be validated against CloudWatch Logs.
  ```
- To prevent race conditions, `aws_api_gateway_account` must explicitly declare `depends_on = [aws_iam_role_policy_attachment.apigateway_logs]`.

---

### 2.3 Codebase Analysis & Current State

1. **`infra/iam.tf`**:
   - `data "aws_iam_policy_document" "apigateway_assume_role"`: Properly configures `sts:AssumeRole` with principal `apigateway.amazonaws.com`.
   - `aws_iam_role.apigateway_logs`: Creates `${local.name_prefix}-apigw-logs-role`.
   - `aws_iam_role_policy_attachment.apigateway_logs`: Attaches the policy, but previously had the typo `AmazonAPIGatewayPushCloudWatchLogs` (missing `To`). Must be `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`.
   - `aws_api_gateway_account.this`: Associates `cloudwatch_role_arn = aws_iam_role.apigateway_logs.arn` and specifies `depends_on = [aws_iam_role_policy_attachment.apigateway_logs]`.

2. **`infra/api-gateway.tf`**:
   - `aws_api_gateway_stage.tmdb_proxy`: Configures `access_log_settings` and specifies `depends_on = [aws_api_gateway_account.this, ...]`.

3. **Deploy Role & CI/CD (`.github/workflows/deploy-aws-proxy.yml`)**:
   - Deploy role assumes `cinemaclub-github-actions-production-deploy` via GitHub OIDC.
   - Deploy role must have permissions for `iam:AttachRolePolicy`, `iam:DetachRolePolicy`, `apigateway:*`, `lambda:ListVersionsByFunction`, etc.

---

## 3. Implementation Guidance & Code Examples

### 3.1 Terraform (HCL) Implementation

```hcl
# 1. Trust Relationship for API Gateway
data "aws_iam_policy_document" "apigateway_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

# 2. IAM Role for API Gateway CloudWatch Logging
resource "aws_iam_role" "apigateway_logs" {
  name               = substr("${local.name_prefix}-apigw-logs-role", 0, 64)
  assume_role_policy = data.aws_iam_policy_document.apigateway_assume_role.json
  tags               = local.common_tags
}

# 3. Attach AWS Managed Policy: AmazonAPIGatewayPushToCloudWatchLogs
resource "aws_iam_role_policy_attachment" "apigateway_logs" {
  role       = aws_iam_role.apigateway_logs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

# 4. Configure API Gateway Regional Account Settings
resource "aws_api_gateway_account" "this" {
  cloudwatch_role_arn = aws_iam_role.apigateway_logs.arn

  depends_on = [
    aws_iam_role_policy_attachment.apigateway_logs,
  ]
}
```

---

### 3.2 CloudFormation (YAML) Implementation

```yaml
Resources:
  ApiGatewayLoggingRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "${AWS::StackName}-apigw-logs-role"
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service:
                - apigateway.amazonaws.com
            Action:
              - sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs

  ApiGatewayAccount:
    Type: AWS::ApiGateway::Account
    DependsOn:
      - ApiGatewayLoggingRole
    Properties:
      CloudWatchRoleArn: !GetAtt ApiGatewayLoggingRole.Arn
```

---

### 3.3 AWS CLI Implementation

```sh
# 1. Create trust policy
cat > apigw-trust-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

# 2. Create the IAM role
aws iam create-role \
  --role-name cinemaclub-apigw-logs-role \
  --assume-role-policy-document file://apigw-trust-policy.json

# 3. Attach the canonical managed policy (PushToCloudWatchLogs)
aws iam attach-role-policy \
  --role-name cinemaclub-apigw-logs-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs

# 4. Get Role ARN and update API Gateway account
ROLE_ARN=$(aws iam get-role --role-name cinemaclub-apigw-logs-role --query 'Role.Arn' --output text)
aws apigateway update-account \
  --patch-operations op='replace',path='/cloudwatchRoleArn',value="${ROLE_ARN}"
```

---

### 3.4 AWS CDK (TypeScript) Implementation

```typescript
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class ApiGatewayLoggingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create role with trust to apigateway.amazonaws.com and managed policy
    const apiGatewayLoggingRole = new iam.Role(this, 'ApiGatewayLoggingRole', {
      roleName: 'cinemaclub-apigw-logs-role',
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs'),
      ],
    });

    // 2. Associate role with API Gateway Account settings
    const cfnAccount = new apigateway.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayLoggingRole.roleArn,
    });
    cfnAccount.node.addDependency(apiGatewayLoggingRole);
  }
}
```

---

## 4. GitHub Actions Deployment IAM Policy Matrix

The deployment role (`cinemaclub-github-actions-production-deploy`) requires permissions across AWS services:

| AWS Service | Required Actions | Target Resource Scope | Reason / Provider Resource |
|---|---|---|---|
| **IAM** | `iam:CreateRole`<br>`iam:DeleteRole`<br>`iam:GetRole`<br>`iam:GetRolePolicy`<br>`iam:PutRolePolicy`<br>`iam:DeleteRolePolicy`<br>`iam:ListRolePolicies`<br>`iam:ListAttachedRolePolicies`<br>`iam:ListInstanceProfilesForRole`<br>`iam:AttachRolePolicy`<br>`iam:DetachRolePolicy`<br>`iam:TagRole`<br>`iam:UntagRole`<br>`iam:PassRole`<br>`iam:UpdateAssumeRolePolicy` | `arn:aws:iam::<ACCOUNT_ID>:role/cinemaclub-tmdb-proxy-*` | Manages Lambda execution role (`aws_iam_role.lambda`) and API Gateway logging role (`aws_iam_role.apigateway_logs`). `iam:PassRole` allows assigning roles to Lambda and API Gateway services. |
| **Lambda** | `lambda:CreateFunction`<br>`lambda:DeleteFunction`<br>`lambda:GetFunction`<br>`lambda:GetFunctionConfiguration`<br>`lambda:GetFunctionCodeSigningConfig`<br>`lambda:UpdateFunctionCode`<br>`lambda:UpdateFunctionConfiguration`<br>`lambda:AddPermission`<br>`lambda:RemovePermission`<br>`lambda:GetPolicy`<br>`lambda:ListVersionsByFunction`<br>`lambda:ListAliases`<br>`lambda:ListEventSourceMappings`<br>`lambda:ListProvisionedConcurrencyConfigs`<br>`lambda:ListFunctionUrlConfigs`<br>`lambda:TagResource`<br>`lambda:UntagResource`<br>`lambda:ListTags` | `arn:aws:lambda:<REGION>:<ACCOUNT_ID>:function:cinemaclub-tmdb-proxy-*` | Manages `aws_lambda_function.tmdb_proxy` and `aws_lambda_permission.apigateway_invoke`. `ListVersionsByFunction` is essential for Terraform state inspection. |
| **API Gateway** | `apigateway:GET`<br>`apigateway:POST`<br>`apigateway:PUT`<br>`apigateway:PATCH`<br>`apigateway:DELETE` | `arn:aws:apigateway:<REGION>::/account`<br>`arn:aws:apigateway:<REGION>::/restapis`<br>`arn:aws:apigateway:<REGION>::/restapis/*`<br>`arn:aws:apigateway:<REGION>::/tags/*` | Manages REST API, resources, methods, integrations, gateway responses, deployments, stages, method settings, and regional account settings (`aws_api_gateway_account.this`). |
| **CloudWatch Logs** | `logs:CreateLogGroup`<br>`logs:DeleteLogGroup`<br>`logs:PutRetentionPolicy`<br>`logs:DeleteRetentionPolicy`<br>`logs:DescribeLogGroups`<br>`logs:TagResource`<br>`logs:UntagResource`<br>`logs:ListTagsForResource`<br>`logs:ListTagsLogGroup`<br>`logs:FilterLogEvents` | `arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:/aws/lambda/cinemaclub-tmdb-proxy-*`<br>`arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:/aws/apigateway/cinemaclub-tmdb-proxy-*`<br>`arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:API-Gateway-Execution-Logs_*`<br>`arn:aws:logs:<REGION>:<ACCOUNT_ID>:log-group:*` | Manages log groups (`aws_cloudwatch_log_group.lambda`, `api_access`, `api_execution`) and post-deploy log assertions in CI/CD. |
| **CloudWatch Metrics & Alarms** | `cloudwatch:PutMetricAlarm`<br>`cloudwatch:DeleteAlarms`<br>`cloudwatch:DescribeAlarms`<br>`cloudwatch:TagResource`<br>`cloudwatch:UntagResource`<br>`cloudwatch:ListTagsForResource` | `arn:aws:cloudwatch:<REGION>:<ACCOUNT_ID>:alarm:cinemaclub-tmdb-proxy-*`<br>`arn:aws:cloudwatch:<REGION>:<ACCOUNT_ID>:alarm:*` | Manages metric alarms (`aws_cloudwatch_metric_alarm.lambda_errors`, `lambda_throttles`, `lambda_duration`, `api_gateway_5xx`) and workflow verification checks. |

---

## 5. Summary Table of Action Items

| Component | File / Resource | Action Required | Status |
|---|---|---|---|
| **Terraform IAM** | `infra/iam.tf` (`aws_iam_role_policy_attachment.apigateway_logs`) | Ensure policy ARN is `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs` (PascalCase with `To`) | Verified & Specified |
| **Terraform Account** | `infra/iam.tf` (`aws_api_gateway_account.this`) | Ensure `depends_on = [aws_iam_role_policy_attachment.apigateway_logs]` is present | Verified & Specified |
| **Deploy IAM Policy** | `cinemaclub-github-actions-production-deploy` / docs | Include `lambda:ListVersionsByFunction`, `iam:AttachRolePolicy`, `iam:DetachRolePolicy`, `apigateway:GET`, `apigateway:PATCH`, `apigateway:PUT` on `/account` | Verified & Specified |
| **Deployment Guide** | `docs/SubAgent docs/tmdb-aws-deployment-configuration-guide.md` | Update example JSON policy in section 7.3 with full permission set | Verified & Specified |

