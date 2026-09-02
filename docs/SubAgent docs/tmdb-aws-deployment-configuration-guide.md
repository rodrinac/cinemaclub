# TMDB AWS deployment configuration guide

This guide is for the current `rodrinac/cinemaclub` AWS deployment workflow at `.github/workflows/deploy-aws-proxy.yml`. It describes only behavior verified in the repository today.

## 1. What this workflow deploys today

The current production deploy path is:

- GitHub Actions workflow: `Deploy AWS TMDB Proxy`
- Trigger file: `.github/workflows/deploy-aws-proxy.yml`
- Terraform root: `infra/`
- Runtime shape: API Gateway REST API -> Node.js Lambda -> TMDB
- Client base URL output: `movies_api_base_url`
- Expected client env value after deploy: `EXPO_PUBLIC_MOVIES_API_URL=<stage invoke url>/api`

Automatic triggers:

- `workflow_dispatch`
- `push` to `main` or `master`
- only when one of these paths changes:
  - `infra/**`
  - `server/**`
  - `scripts/smoke-aws-proxy.mjs`
  - `.github/workflows/deploy-aws-proxy.yml`

The deploy job always targets the GitHub environment named `production`.

## 2. Pick the AWS account and region first

Do this before creating the secret or the OIDC role.

### GitHub / console choices

- GitHub repo: `rodrinac/cinemaclub`
- GitHub environment name: `production`
- AWS Console account switcher: top-right account menu -> choose the production AWS account
- AWS Console region selector: top-right region menu -> choose the region you will also store in GitHub as `AWS_REGION`

### CLI checks

```sh
aws sts get-caller-identity
aws ec2 describe-regions --region us-east-1 --query 'Regions[].RegionName' --output text

export AWS_REGION="eu-west-1"   # example; choose your real production region
aws configure set region "$AWS_REGION"
```

Use one region consistently for:

- GitHub `AWS_REGION`
- the TMDB Secrets Manager secret
- the Lambda/API Gateway deployment

## 3. Create the GitHub `production` environment

GitHub UI path:

- Repo -> **Settings** -> **Environments** -> **New environment**
- Name it exactly: `production`

After it exists, use this page only:

- Repo -> **Settings** -> **Environments** -> **production**

Inside `production`, you will use:

- **Environment secrets**
- **Environment variables**
- **Deployment protection rules**

Do **not** put the deploy values on the repository-wide Actions secrets page unless the workflow is changed. The current workflow reads the deploy configuration from the `production` environment.

## 4. Create and store the TMDB bearer secret in AWS Secrets Manager

The Lambda does **not** expect JSON. It expects the secret value itself to be the raw TMDB bearer token string, because the runtime reads `SecretString.trim()`.

### AWS Console path

- AWS Console -> **Secrets Manager** -> **Secrets** -> **Store a new secret**
- Secret type: plain text / other secret
- Paste the raw TMDB bearer token only
- Suggested name: `cinemaclub/tmdb/prod/bearer`
- Keep the secret in the same AWS account and region selected above
- Prefer the AWS-managed key unless your org requires a customer-managed KMS key

If you use a customer-managed KMS key, the repo does **not** currently grant `kms:Decrypt` to the Lambda execution role, so you must add that permission externally.

### CLI creation

```sh
export TMDB_SECRET_NAME="cinemaclub/tmdb/prod/bearer"
read -r -s TMDB_BEARER_TOKEN
export TMDB_BEARER_TOKEN

aws secretsmanager create-secret \
  --name "$TMDB_SECRET_NAME" \
  --description "TMDB bearer token for Cinema Club production proxy" \
  --secret-string "$TMDB_BEARER_TOKEN" \
  --region "$AWS_REGION"

unset TMDB_BEARER_TOKEN

export TMDB_SECRET_ARN="$(aws secretsmanager describe-secret \
  --secret-id "$TMDB_SECRET_NAME" \
  --region "$AWS_REGION" \
  --query 'ARN' \
  --output text)"

echo "$TMDB_SECRET_ARN"
```

To rotate later:

```sh
read -r -s TMDB_BEARER_TOKEN
export TMDB_BEARER_TOKEN

aws secretsmanager put-secret-value \
  --secret-id "$TMDB_SECRET_NAME" \
  --secret-string "$TMDB_BEARER_TOKEN" \
  --region "$AWS_REGION"

unset TMDB_BEARER_TOKEN
```

## 5. Understand the current Terraform state limitation before you deploy

### Current repo behavior

The current repo has **no Terraform backend block** under `infra/`, so `terraform init` uses the implicit local backend.

That means today:

- a single `terraform init/plan/apply` run can succeed
- the workflow can finish because plan, apply, output export, and smoke checks all happen in the same runner
- the state is **not persisted** across fresh GitHub-hosted runners
- repeat deploys or destroy operations can drift, fail, or try to recreate resources

Also note:

- `.gitignore` excludes `*.tfstate`, `*.tfstate.*`, `*.tfplan`, `*.tfvars`, and `infra/build/`
- there is **no destroy workflow** in `.github/workflows/`

### What “bootstrap” means today

Today, the first state bootstrap is just local state created by:

```sh
terraform -chdir=infra init
```

That is acceptable only for one local workstation session or one single GitHub Actions runner session. It is **not** dependable production state management.

## 6. Recommended remote backend before you rely on repeat deploys or destroy

If you want dependable production deploy/destroy behavior, add a remote S3 backend in a follow-up change before treating this as repeatable infrastructure.

### Recommended backend resources

Create:

- a private S3 bucket for Terraform state
- bucket versioning enabled
- bucket encryption enabled
- public access blocked
- locking by either:
  - DynamoDB lock table, or
  - S3 native lock file (`use_lockfile=true`)

### Example backend bootstrap commands

```sh
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export TF_STATE_BUCKET="cinemaclub-tf-state-${AWS_ACCOUNT_ID}-${AWS_REGION}"
export TF_STATE_KEY="tmdb-proxy/prod/terraform.tfstate"
export TF_STATE_LOCK_TABLE="cinemaclub-tf-locks"
export TF_STATE_REGION="$AWS_REGION"

aws s3api create-bucket \
  --bucket "$TF_STATE_BUCKET" \
  --region "$TF_STATE_REGION" \
  --create-bucket-configuration LocationConstraint="$TF_STATE_REGION"

aws s3api put-bucket-versioning \
  --bucket "$TF_STATE_BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-public-access-block \
  --bucket "$TF_STATE_BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-encryption \
  --bucket "$TF_STATE_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws dynamodb create-table \
  --table-name "$TF_STATE_LOCK_TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$TF_STATE_REGION"
```

If the backend region is `us-east-1`, omit `--create-bucket-configuration LocationConstraint=...` when creating the bucket.

### Recommended backend block to add later

The repo does **not** contain this block today. Add it in a future infra change when you are ready to persist state:

```hcl
terraform {
  backend "s3" {}
}
```

Then initialize with account-specific values:

```sh
terraform -chdir=infra init -migrate-state \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=$TF_STATE_KEY" \
  -backend-config="region=$TF_STATE_REGION" \
  -backend-config="encrypt=true" \
  -backend-config="dynamodb_table=$TF_STATE_LOCK_TABLE"
```

If you prefer S3 native lock files instead of DynamoDB locking, use:

```sh
terraform -chdir=infra init -migrate-state \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=$TF_STATE_KEY" \
  -backend-config="region=$TF_STATE_REGION" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"
```

### Important current limitation

The current GitHub workflow still runs plain:

```sh
terraform -chdir=infra init
```

So even if you pre-create backend resources, GitHub Actions will **not** use them until the workflow or checked-in backend configuration is updated.

Recommended future GitHub environment variables once backend support is wired into the workflow:

- `TF_STATE_BUCKET`
- `TF_STATE_KEY`
- `TF_STATE_REGION`
- `TF_STATE_LOCK_TABLE` (if you choose DynamoDB locking)

## 7. Create the GitHub Actions OIDC provider and deployment role

The workflow already requests:

- `permissions.contents: read`
- `permissions.id-token: write`

AWS must trust GitHub’s OIDC tokens from this repo and this exact environment.

### 7.1 Create the OIDC provider

AWS Console path:

- AWS Console -> **IAM** -> **Identity providers** -> **Add provider**
- Provider type: **OpenID Connect**
- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

CLI example:

```sh
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

If the provider already exists, reuse it.

### 7.2 Create the production deploy role trust policy

The trust must allow `sts:AssumeRoleWithWebIdentity` and lock the role to this repo/environment pair:

- `aud`: `sts.amazonaws.com`
- `sub`: `repo:rodrinac/cinemaclub:environment:production`

Trust policy template:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:rodrinac/cinemaclub:environment:production"
        }
      }
    }
  ]
}
```

CLI example:

```sh
cat > github-actions-production-trust.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:rodrinac/cinemaclub:environment:production"
        }
      }
    }
  ]
}
JSON

# Replace ACCOUNT_ID in the file before running create-role.
aws iam create-role \
  --role-name cinemaclub-github-actions-production-deploy \
  --assume-role-policy-document file://github-actions-production-trust.json
```

### 7.3 Attach a least-privilege deployment policy

This deploy role needs permission to manage the Terraform-created resources only:

- API Gateway REST API, resource, methods, integrations, deployment, stage, method settings, gateway responses, account logging role association
- Lambda function and Lambda invoke permission for API Gateway
- IAM roles, inline role policies, and managed policy attachments for:
  - `${service_name}-${stage_name}-lambda-role`
  - `${service_name}-${stage_name}-apigw-logs-role` (attaches `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`)
- CloudWatch log groups
- CloudWatch alarms

It does **not** need Secrets Manager read access for normal deploys, because Terraform only receives the secret ARN.

Use the GitHub variable values to scope names. With the example values in this repo:

- `TMDB_PROXY_SERVICE_NAME=cinemaclub-tmdb-proxy`
- `TMDB_PROXY_STAGE_NAME=prod`

that yields the current naming prefix:

- `cinemaclub-tmdb-proxy-prod`

Example inline policy template:

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

CLI example:

```sh
cat > cinemaclub-tmdb-proxy-deploy-policy.json <<'JSON'
...replace placeholders in the JSON template above...
JSON

aws iam put-role-policy \
  --role-name cinemaclub-github-actions-production-deploy \
  --policy-name cinemaclub-tmdb-proxy-deploy \
  --policy-document file://cinemaclub-tmdb-proxy-deploy-policy.json
```

### 7.4 Save the role ARN for GitHub

```sh
export AWS_ROLE_TO_ASSUME="$(aws iam get-role \
  --role-name cinemaclub-github-actions-production-deploy \
  --query 'Role.Arn' \
  --output text)"

echo "$AWS_ROLE_TO_ASSUME"
```

## 8. Populate the exact GitHub `production` secrets and variables

GitHub UI path:

- Repo -> **Settings** -> **Environments** -> **production**

### Environment secrets

| Name | Required? | Value |
| --- | --- | --- |
| `AWS_ROLE_TO_ASSUME` | yes | Full IAM role ARN for the GitHub OIDC deploy role |
| `TMDB_SECRET_ARN` | yes | Full Secrets Manager ARN created in step 4 |

### Environment variables

| Name | Required? | Value shape | Notes |
| --- | --- | --- | --- |
| `AWS_REGION` | yes | e.g. `eu-west-1` | Must match the actual deployment region |
| `TMDB_PROXY_SERVICE_NAME` | yes | e.g. `cinemaclub-tmdb-proxy` | Drives resource names |
| `TMDB_PROXY_STAGE_NAME` | yes | e.g. `prod` | API Gateway stage name |
| `TMDB_PROXY_LOG_RETENTION_DAYS` | yes | valid CloudWatch retention like `14` | Must match a Terraform-accepted retention number |
| `TMDB_PROXY_CORS_ALLOW_ORIGIN` | intended optional, currently needed for first success in the pinned GitHub Actions workflow | one exact origin like `https://app.example.com` | No wildcard, no comma-separated list, no blank string |
| `TMDB_PROXY_RATE_LIMIT_RPS` | optional | positive number | Must be set together with burst |
| `TMDB_PROXY_RATE_LIMIT_BURST` | optional | integer `>= 1` | Must be set together with rps |
| `TMDB_PROXY_ALARM_NOTIFICATION_ARN` | optional | SNS topic ARN or other supported alarm action ARN | Only used if you want alarm actions |
| `TMDB_PROXY_LAMBDA_ERROR_ALARM_THRESHOLD` | optional | number | Creates the Lambda Errors alarm when set |
| `TMDB_PROXY_LAMBDA_THROTTLE_ALARM_THRESHOLD` | optional | number | Creates the Lambda Throttles alarm when set |
| `TMDB_PROXY_LAMBDA_DURATION_ALARM_THRESHOLD_MS` | optional | number | Creates the Lambda Duration alarm when set |
| `TMDB_PROXY_API_5XX_ALARM_THRESHOLD` | optional | number | Creates the API Gateway 5XX alarm when set |

### Rate-limit pairing rule

These are a pair:

- `TMDB_PROXY_RATE_LIMIT_RPS`
- `TMDB_PROXY_RATE_LIMIT_BURST`

Set both or set neither. If only one is set, the workflow fails before Terraform plan.

### Alarm behavior

Alarm threshold variables are independent. Each non-null threshold creates its matching alarm.

- If thresholds are set and `TMDB_PROXY_ALARM_NOTIFICATION_ARN` is empty, alarms still exist but have no actions.
- If `TMDB_PROXY_ALARM_NOTIFICATION_ARN` is set and thresholds are empty, no alarms are created because the resources are threshold-driven.

### Important: do not confuse these with other repo secrets

The following are **not** part of AWS deploy configuration:

GitHub UI path:

- Repo -> **Settings** -> **Secrets and variables** -> **Actions** -> **Repository secrets**

Repository secrets used elsewhere:

- `TMDB_API_TOKEN` -> only for `.github/workflows/ci.yml` live E2E
- `BADGE_FURY_WEBHOOK_URL` -> only for `.github/workflows/badgefury-webhook.yml`

## 9. Configure production approvals

The workflow itself does not pause for approval in code. It runs `terraform apply -auto-approve`.

Approvals must be configured on the environment.

GitHub UI path:

- Repo -> **Settings** -> **Environments** -> **production** -> **Deployment protection rules**

Recommended settings:

- add **Required reviewers** for production changes
- optionally add a **Wait timer**

Because the job uses `environment: production`, those protection rules are what gate the deploy.

## 10. Trigger the deployment

### Manual trigger

GitHub UI path:

- Repo -> **Actions** -> **Deploy AWS TMDB Proxy** -> **Run workflow**

Then:

- choose the branch you want to deploy
- click **Run workflow**
- approve the `production` deployment if your environment requires approval

### Automatic trigger

Push or merge to `main` or `master` with changes under one of these paths:

- `infra/**`
- `server/**`
- `scripts/smoke-aws-proxy.mjs`
- `.github/workflows/deploy-aws-proxy.yml`

## 11. What the workflow validates automatically

The deploy workflow performs these checks in this order:

1. validates required GitHub secrets/variables are non-blank
2. validates rate-limit pair presence
3. runs `terraform -chdir=infra init`
4. runs `terraform -chdir=infra plan -input=false -out=deploy.tfplan`
5. runs `terraform -chdir=infra apply -input=false -auto-approve deploy.tfplan`
6. exports Terraform outputs to `infra/terraform-output.json` inside the runner
7. runs `node scripts/smoke-aws-proxy.mjs`
8. verifies:
   - API Gateway stage exists
   - stage has access logs and method settings
   - Lambda log group exists
   - API access log group exists
   - API execution log group exists
   - `DEFAULT_4XX` gateway response matches configured CORS mapping
   - any configured CloudWatch alarms exist
   - Lambda logs contain at least one cache-hit event after the smoke test

### Automatic smoke assertions

`node scripts/smoke-aws-proxy.mjs` checks:

- `GET /health` -> `200` and `{ "status": "ok" }`
- `GET /api/movies/popular?page=1&language=en-US` -> `200`
- successful movie responses include `Cache-Control: public, max-age=60`
- invalid query -> `400`
- path traversal attempt -> `400`
- invalid method (`POST /health`) -> `405`
- if CORS is configured:
  - exact `Access-Control-Allow-Origin`
  - `Vary: Origin`
  - preflight `OPTIONS` returns `204`
  - preflight methods are `GET, OPTIONS`
  - preflight headers are `Content-Type`
- if CORS is not configured:
  - forbidden CORS headers must be absent
- if rate limiting is configured:
  - at least one `429`
  - `Retry-After` header exists and is `>= 1`
  - response body `parameters.retry_after` matches the header
  - `/health` still returns `200`

## 12. Capture the production URL after a successful deploy

The important Terraform output is:

- `movies_api_base_url`

That is the exact value the app should use for:

```sh
EXPO_PUBLIC_MOVIES_API_URL=<movies_api_base_url>
```

The workflow also has these non-secret outputs conceptually available during apply/output:

- `stage_invoke_url`
- `rest_api_id`
- `stage_name`
- `lambda_function_name`
- `lambda_log_group_name`
- `api_access_log_group_name`
- `api_execution_log_group_name`
- `alarm_names`

Because the current workflow uses local runner state only, capture `movies_api_base_url` from the successful Terraform output / workflow logs right away unless you add remote state.

## 13. Manual post-deploy smoke checks you can run yourself

Set the output values first:

```sh
export REST_API_ID="replace-me"
export STAGE_NAME="prod"                     # or your real TMDB_PROXY_STAGE_NAME
export STAGE_URL="https://${REST_API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE_NAME}"
export MOVIES_API_BASE_URL="${STAGE_URL}/api"
```

Quick checks:

```sh
curl -i "$STAGE_URL/health"
curl -i "$MOVIES_API_BASE_URL/movies/popular?page=1&language=en-US"
curl -i "$MOVIES_API_BASE_URL/movies/popular?unknown_param=1"
curl -i -X POST "$STAGE_URL/health"
```

If CORS is enabled, verify the configured exact origin:

```sh
export CORS_ORIGIN="https://app.example.com"

curl -i -X OPTIONS "$MOVIES_API_BASE_URL/movies/popular" \
  -H "Origin: $CORS_ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```

If you have the repo checked out locally, you can rerun the official smoke script:

```sh
export SMOKE_STAGE_URL="$STAGE_URL"
export SMOKE_CORS_ALLOW_ORIGIN="$CORS_ORIGIN"          # only if CORS is enabled
export SMOKE_RATE_LIMIT_RPS="5"                         # only if rate limiting is enabled
export SMOKE_RATE_LIMIT_BURST="5"                       # only if rate limiting is enabled
node scripts/smoke-aws-proxy.mjs
```

## 14. Operations and monitoring

### Always-created log groups

The Terraform stack always creates:

- Lambda log group: `/aws/lambda/<function name>`
- API Gateway access log group: `/aws/apigateway/<name-prefix>-access`
- API Gateway execution log group: `API-Gateway-Execution-Logs_<restApiId>/<stage>`

### Stage behavior verified in Terraform

- API Gateway access logging: enabled
- API Gateway method metrics: enabled
- API Gateway logging level: `ERROR`
- X-Ray tracing: disabled

### Useful AWS CLI checks

```sh
export NAME_PREFIX="${TMDB_PROXY_SERVICE_NAME}-${TMDB_PROXY_STAGE_NAME}"

aws apigateway get-stage --rest-api-id "$REST_API_ID" --stage-name "$STAGE_NAME"

aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/$LAMBDA_FUNCTION_NAME"
aws logs describe-log-groups --log-group-name-prefix "/aws/apigateway/${NAME_PREFIX}-access"
aws logs describe-log-groups --log-group-name-prefix "API-Gateway-Execution-Logs_${REST_API_ID}/$STAGE_NAME"

aws logs filter-log-events \
  --log-group-name "/aws/lambda/$LAMBDA_FUNCTION_NAME" \
  --filter-pattern '{ $.cache = "hit" }' \
  --limit 20

aws cloudwatch describe-alarms --alarm-name-prefix "$NAME_PREFIX"
```

### Optional alarms

These alarms exist only when their threshold variable is set:

- Lambda Errors
- Lambda Throttles
- Lambda Duration
- API Gateway 5XXError

## 15. Teardown

Current reality:

- there is no destroy workflow
- current GitHub Actions state is local-to-runner only
- dependable destroy/redeploy requires persistent Terraform state first

That means the only reliable teardown today is:

- run `terraform destroy` using the **same state location that created the stack**
- or add a remote backend first, then manage the stack from that persistent state

If a fresh GitHub-hosted runner created the stack and no remote backend existed, do **not** assume a later fresh runner can destroy or update it cleanly.

## 16. Troubleshooting

Keep these two categories separate.

### 16.1 Expected configuration-caused failures

| Symptom | Likely cause | What to fix |
| --- | --- | --- |
| deploy validation fails before Terraform | missing required environment secret/variable | populate `AWS_ROLE_TO_ASSUME`, `TMDB_SECRET_ARN`, `AWS_REGION`, `TMDB_PROXY_SERVICE_NAME`, `TMDB_PROXY_STAGE_NAME`, `TMDB_PROXY_LOG_RETENTION_DAYS` in GitHub `production` |
| AWS credentials step fails | bad `AWS_ROLE_TO_ASSUME` or broken OIDC trust | verify the role ARN, OIDC provider, `aud`, and `sub` trust conditions |
| plan/apply fails on rate limiting | only one of the rate-limit variables is set | set both `TMDB_PROXY_RATE_LIMIT_RPS` and `TMDB_PROXY_RATE_LIMIT_BURST`, or clear both |
| smoke CORS assertions fail | `TMDB_PROXY_CORS_ALLOW_ORIGIN` does not exactly match the caller origin | use one exact origin string; no wildcard, no comma-separated list |
| Lambda returns `502` when fetching TMDB data | bad `TMDB_SECRET_ARN`, empty secret value, or missing secret/KMS runtime permission | verify the secret ARN, the raw token value, and KMS access if using a CMK |
| repeat deploys drift or duplicate resources | local state was lost between runs | add remote state before depending on repeat deploy/destroy |

### 16.2 Known existing Terraform defect: null CORS validation

This is a current implementation defect in the repository’s GitHub Actions deployment path, not normal user error.

Verified defect:

- file: `infra/variables.tf`
- current failing path: GitHub Actions workflow pinned to Terraform `1.11.4`
- symptom: Terraform plan/CI fails with `Invalid function argument`
- message includes: `var.cors_allow_origin is null`

Why it happens:

- the workflow intentionally normalizes blank optional variables away before `terraform plan`
- that makes `cors_allow_origin` become `null`
- the current Terraform validation for `cors_allow_origin` is not null-safe in practice

Current workaround for first successful deploy:

- set `TMDB_PROXY_CORS_ALLOW_ORIGIN` to one non-empty exact origin, such as `https://app.example.com`

Do **not** misclassify this as operator misconfiguration when the intent was “leave CORS unset.” The repository’s design says CORS should be optional, but the current validation implementation still breaks on `null`.
