# Root Cause Analysis: AWS TMDB Proxy Smoke Test 401 Failure

## Executive Summary

During the execution of the GitHub Actions workflow `.github/workflows/deploy-aws-proxy.yml`, the smoke test step `node scripts/smoke-aws-proxy.mjs` failed with:
```
Error: Popular request returned 401
```

This analysis details the exact execution flow, authentication boundaries, secret propagation mechanisms, and root cause for this error.

---

## 1. Analysis of `scripts/smoke-aws-proxy.mjs`

### 1.1 Endpoint & Request Details
The smoke test script performs the following sequence:
1. **Health Check**: `GET ${baseStageUrl}/health`
   - Returns HTTP 200 `{ status: "ok" }`.
   - Passes because `/health` is evaluated purely locally in the proxy handler without consulting AWS Secrets Manager or TMDB.
2. **Popular Movies Request**: `GET ${apiBaseUrl}/movies/popular?page=1&language=en-US` (`line 56-59`)
   - Target URL: `https://<api-id>.execute-api.<region>.amazonaws.com/<stage>/api/movies/popular?page=1&language=en-US`
   - Headers Sent: Only `Origin: <SMOKE_CORS_ALLOW_ORIGIN>` (if configured). **No client authentication headers** (`Authorization`, `x-api-key`, `x-proxy-secret`) are sent.
   - Response Assertion: `assert(firstPopular.response.status === 200, \`Popular request returned \${firstPopular.response.status}\`);` (`line 61`).
   - Failure: The proxy responded with HTTP 401, causing this assertion to fail immediately.

---

## 2. Lambda Handler Request & Authentication Flow

### 2.1 Request Lifecycle in `server/tmdb-lambda.mjs` & `server/tmdb-proxy-core.mjs`
1. **Routing & Validation**:
   - `matchRoute("/api/movies/popular")` matches the route descriptor for TMDB endpoint `movie/popular`.
   - `validateQueryParams(...)` verifies `page=1` and `language=en-US`.
   - Cache check: miss on the initial request.
   - Rate limit check: allowed.
2. **Token Retrieval (`getToken`)**:
   - In AWS Lambda, `createSecretsManagerTokenProvider` fetches the secret payload from AWS Secrets Manager using `GetSecretValueCommand` with `SecretId = process.env.TMDB_SECRET_ARN`.
   - If Secrets Manager call fails (e.g., missing IAM permission, secret does not exist, network failure):
     - Handler catches the error and returns **HTTP 502 Bad Gateway** (`Unable to reach the movie service.`).
   - If Secrets Manager call succeeds:
     - The secret string is stored in memory and used as the bearer token.
3. **Upstream TMDB Request**:
   - The proxy calls `https://api.themoviedb.org/3/movie/popular?page=1&language=en-US` with:
     ```http
     Accept: application/json
     Authorization: Bearer <TOKEN_FROM_SECRETS_MANAGER>
     ```
4. **Upstream Response Handling**:
   - TMDB validates the Bearer token.
   - When the token stored in AWS Secrets Manager is **invalid, expired, revoked, malformed, or a placeholder** (such as `"your_tmdb_bearer_token"` or an empty string):
     - Upstream TMDB API responds with **HTTP 401 Unauthorized** (e.g. `{"status_code": 7, "status_message": "Invalid API key: You must be granted a valid key."}`).
   - The proxy code in `server/tmdb-proxy-core.mjs` (`lines 736-752`) does **not** map 401 to 502; instead, it passes through the upstream HTTP status:
     ```javascript
     return jsonResponse(response.status, body, {
       ...corsHeaders,
       ...(isSuccessful ? { "Cache-Control": SUCCESS_CACHE_CONTROL } : {}),
     });
     ```
   - Therefore, the client receives HTTP 401 directly from the proxy.

---

## 3. Secret Propagation & Infrastructure Wiring

### 3.1 GitHub Actions Workflow (`.github/workflows/deploy-aws-proxy.yml`)
- Secrets/variables injected into environment:
  - `TF_VAR_tmdb_secret_arn: ${{ secrets.TMDB_SECRET_ARN }}`
  - `role-to-assume: ${{ secrets.AWS_ROLE_TO_ASSUME }}`
- The workflow validates that `TF_VAR_tmdb_secret_arn` is non-empty before running Terraform.
- **Note**: The smoke test step only passes:
  - `SMOKE_STAGE_URL`
  - `SMOKE_CORS_ALLOW_ORIGIN`
  - `SMOKE_RATE_LIMIT_RPS`
  - `SMOKE_RATE_LIMIT_BURST`
  No secrets are passed to the smoke test step because the proxy does not require client-side credentials.

### 3.2 Terraform Configuration (`infra/`)
- `infra/lambda.tf`:
  - Lambda environment variable: `TMDB_SECRET_ARN = var.tmdb_secret_arn`
- `infra/iam.tf`:
  - IAM Role policy grants `secretsmanager:GetSecretValue` on `var.tmdb_secret_arn`.
- `infra/api-gateway.tf`:
  - API Gateway methods `root_any` and `proxy_any` have `authorization = "NONE"`.
  - No API key, AWS IAM authorization, or custom authorizer is enabled.

---

## 4. Authentication Boundaries: Proxy vs Upstream TMDB

| Authentication Dimension | Proxy Authentication (`PROXY_SHARED_SECRET` / `x-proxy-secret`) | Upstream TMDB Authentication (`TMDB_READ_ACCESS_TOKEN` / `TMDB_API_KEY`) |
| :--- | :--- | :--- |
| **Target Boundary** | Client (Browser / Test runner) $\to$ API Gateway / Lambda Proxy | Lambda Proxy $\to$ Upstream TMDB API (`api.themoviedb.org`) |
| **Mechanism** | Shared Secret Header / API Key (e.g. `x-proxy-secret`) | Bearer token in HTTP `Authorization` header (`Authorization: Bearer <token>`) |
| **Current Status in Codebase** | **Not implemented / Not required.** Public endpoint guarded by CORS and rate limiting. Authorization is `NONE`. | **Implemented.** Fetched dynamically from AWS Secrets Manager (`TMDB_SECRET_ARN`). |
| **Failure Behavior** | If implemented and missing/wrong: would return 401/403 at API Gateway/Lambda level. | If invalid/expired/placeholder in Secrets Manager: TMDB returns 401, which Lambda proxies directly as 401. |

---

## 5. Root Cause & Verification Matrix

### 5.1 Root Cause
The 401 error is caused by **upstream TMDB authentication failure**.
1. The proxy received a valid unauthenticated client request to `/api/movies/popular`.
2. Lambda successfully retrieved the secret string referenced by `TMDB_SECRET_ARN` in AWS Secrets Manager.
3. Lambda invoked `https://api.themoviedb.org/3/movie/popular` with `Authorization: Bearer <SecretString>`.
4. Upstream TMDB API rejected the Bearer token with HTTP 401 Unauthorized.
5. Lambda forwarded the 401 status to the smoke test runner.

### 5.2 Verification / Diagnostic Checks
To remediate this failure in the deployment environment:
1. Verify the GitHub Actions secret `TMDB_SECRET_ARN` points to the intended AWS Secrets Manager secret ARN in the target AWS account/region.
2. Check the value stored inside the AWS Secrets Manager secret:
   ```bash
   aws secretsmanager get-secret-value --secret-id "<TMDB_SECRET_ARN>" --query SecretString --output text
   ```
3. Ensure the secret contains a valid TMDB v4 Read Access Token (or valid API key formatted for bearer auth), without surrounding quotes, extra whitespace, or placeholder text.
4. Test the token directly against TMDB:
   ```bash
   curl -i "https://api.themoviedb.org/3/movie/popular?page=1&language=en-US" \
     -H "Authorization: Bearer <TOKEN>"
   ```
