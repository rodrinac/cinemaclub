# TMDB Token Format & Authentication Analysis

## Executive Summary

This document presents a comprehensive technical investigation into how The Movie Database (TMDB) authentication tokens are configured, read, and forwarded across the Cinema Club codebase (`server/` / `packages/tmdb-proxy`, `infra/`, `.github/workflows/`, and client applications).

Currently, the proxy implementation strictly expects a **TMDB v4 Read Access Token (Bearer JWT)** and forwards it exclusively using the HTTP `Authorization: Bearer <TOKEN>` header to TMDB's v3 endpoints (`https://api.themoviedb.org/3/`). Supplying a legacy **TMDB v3 API Key** (a 32-character hexadecimal string) causes upstream TMDB authentication failure (**HTTP 401 Unauthorized**) because TMDB does not accept 32-character hexadecimal API keys in the `Authorization: Bearer` header.

---

## 1. Architectural Overview & Token Flow

```
+-----------------------------------------------------------------------------------+
| 1. Client Layer (React Native / Expo Web)                                         |
|    - Never handles TMDB API keys or bearer tokens                                 |
|    - Talks exclusively to Movies API proxy via EXPO_PUBLIC_MOVIES_API_URL         |
+-----------------------------------------------------------------------------------+
                                    |
                                    | HTTP GET /api/movies/... (Unauthenticated / CORS guarded)
                                    v
+-----------------------------------------------------------------------------------+
| 2. Proxy Ingestion Layer                                                          |
|    - Local: server/movies-api.mjs (Node.js HTTP Server)                          |
|        * Reads: process.env.TMDB_API_TOKEN                                        |
|    - Cloud: server/tmdb-lambda.mjs (AWS Lambda behind API Gateway)                |
|        * Reads: process.env.TMDB_SECRET_ARN -> AWS Secrets Manager SecretString   |
+-----------------------------------------------------------------------------------+
                                    |
                                    | Passes token via getToken() into createTmdbProxy()
                                    v
+-----------------------------------------------------------------------------------+
| 3. Core Proxy Logic (server/tmdb-proxy-core.mjs)                                  |
|    - Validates route and query parameters (whitelisted query params only)         |
|    - In-memory LRU cache check (60s TTL)                                          |
|    - In-memory rate limiter check (token bucket)                                  |
|    - Formats upstream request:                                                    |
|        * Target: https://api.themoviedb.org/3/<endpoint>?<safe_params>            |
|        * Header: Authorization: Bearer <TOKEN>                                    |
+-----------------------------------------------------------------------------------+
                                    |
                                    | HTTPS Request with Authorization: Bearer <TOKEN>
                                    v
+-----------------------------------------------------------------------------------+
| 4. Upstream TMDB API (api.themoviedb.org/3)                                       |
|    - Validates Authorization: Bearer header                                       |
|    - Accepts: v4 Read Access Token (JWT starting with eyJ...)                     |
|    - Rejects: v3 API Key (32-char hex string) -> HTTP 401 Unauthorized           |
+-----------------------------------------------------------------------------------+
```

---

## 2. In-Depth Codebase Investigation

### 2.1 Proxy Implementation (`server/tmdb-proxy-core.mjs`, `server/movies-api.mjs`, `server/tmdb-lambda.mjs`)

> *Note on package paths*: In this repository, the proxy logic is housed under `server/` (`tmdb-proxy-core.mjs`, `tmdb-lambda.mjs`, and `movies-api.mjs`). References to `packages/tmdb-proxy` correspond to this modular server subsystem.

#### How the Token is Read
1. **Local Node API (`server/movies-api.mjs`)**:
   ```javascript
   const token = process.env.TMDB_API_TOKEN?.trim();
   if (!token) {
     console.error("TMDB_API_TOKEN is required. Add it to .env before starting the API.");
     process.exit(1);
   }
   const proxy = createTmdbProxy({
     getToken: async () => token,
     ...
   });
   ```
2. **AWS Lambda Handler (`server/tmdb-lambda.mjs`)**:
   ```javascript
   const createSecretsManagerTokenProvider = ({ env = process.env } = {}) => {
     const secretArn = readRequiredEnv(env, "TMDB_SECRET_ARN");
     let cachedToken;
     let inflightRequest;

     return async () => {
       if (cachedToken) return cachedToken;
       if (inflightRequest) return inflightRequest;

       inflightRequest = (async () => {
         const { GetSecretValueCommand, SecretsManagerClient } = await import(
           "@aws-sdk/client-secrets-manager"
         );
         const client = new SecretsManagerClient({
           region: env.AWS_REGION || env.AWS_DEFAULT_REGION,
         });
         const response = await client.send(
           new GetSecretValueCommand({ SecretId: secretArn }),
         );
         const token = response.SecretString?.trim();
         if (!token) {
           throw new Error("Secrets Manager secret did not contain a usable TMDB token.");
         }
         cachedToken = token;
         return token;
       })().catch((error) => {
         inflightRequest = undefined;
         throw error;
       });

       const token = await inflightRequest;
       inflightRequest = undefined;
       return token;
     };
   };
   ```

#### How the Token is Forwarded to Upstream TMDB
In `server/tmdb-proxy-core.mjs` (lines 715–724):
```javascript
const upstreamUrl = buildTmdbUrl(routeMatch.descriptor, routeMatch.movieId, safeParams);
...
const response = await fetchImpl(upstreamUrl, {
  redirect: "error",
  signal: AbortSignal.timeout(effectiveUpstreamTimeoutMs),
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  },
});
```
- **Query Parameter Handling**: `buildTmdbUrl` only appends parameters validated by `validateQueryParams(searchParams, policy)`. Query parameters like `api_key` are **explicitly disallowed** by whitelist validation and will trigger an HTTP 400 response if supplied by a client.
- **Header Forwarding**: The token retrieved from `getToken()` is passed directly into `Authorization: Bearer ${token}`. No transformation or format detection is performed.

---

## 3. TMDB API Key Types & Upstream TMDB Behavior

### 3.1 Token Formats Comparison

| Property | TMDB v3 API Key | TMDB v4 Read Access Token (Bearer Token) |
| :--- | :--- | :--- |
| **Format** | 32-character hexadecimal string (`/^[0-9a-f]{32}$/i`) | JWT starting with `eyJ...` (typically 200+ characters) |
| **Native Transport** | `?api_key=<KEY>` query parameter | `Authorization: Bearer <TOKEN>` HTTP header |
| **Supported on `/3/*`** | Yes (via `?api_key=`) | Yes (via `Authorization: Bearer`) |
| **Supported on `/4/*`** | No | Yes (via `Authorization: Bearer`) |
| **Current Codebase Support** | **Not supported** (triggers 401 upstream) | **Fully supported** (native format) |

### 3.2 Upstream TMDB Authentication Mechanics

1. **`Authorization: Bearer <TOKEN>`**:
   - TMDB's edge gateway inspects the `Authorization` header. If it sees `Bearer <value>`, it parses the token as a JWT signature.
   - **If a v3 API Key (32-char hex string) is sent as `Bearer <hex>`**: Upstream TMDB rejects the request with **HTTP 401 Unauthorized** (TMDB status code `7`: *"Invalid API key: You must be granted a valid key."* or status code `3`: *"Authentication failed"*).
2. **`?api_key=<KEY>`**:
   - TMDB checks the query string for `api_key`. If valid 32-character hex key, access is granted to `/3/*` endpoints.
   - If a JWT is passed as `?api_key=<JWT>`, TMDB fails the request as invalid key format.

---

## 4. Infrastructure, CI/CD, and Environment Variables

### 4.1 Environment Variables Matrix

| Variable Name | Location | Usage | Expected Format |
| :--- | :--- | :--- | :--- |
| `TMDB_API_TOKEN` | `.env`, `.env.template`, CI workflows | Local development server (`server/movies-api.mjs`) & Playwright live tests | TMDB v4 Bearer JWT (`eyJ...`) |
| `TMDB_SECRET_ARN` | Lambda runtime env, GitHub Actions Secrets (`TF_VAR_tmdb_secret_arn`) | Secret ARN in AWS Secrets Manager | AWS ARN (`arn:aws:secretsmanager:...`) |
| `tmdb_secret_arn` | Terraform (`infra/variables.tf`, `infra/locals.tf`, `infra/lambda.tf`) | Passed into Lambda function configuration | AWS ARN string |
| `EXPO_PUBLIC_MOVIES_API_URL` | Frontend (`.env`, `src/api/tmdb/baseUrl.ts`) | Base URL for proxy endpoint | URL (`http://localhost:3001/api` or AWS stage URL) |

### 4.2 Infrastructure Configuration (`infra/`)
- **`infra/variables.tf`**:
  ```hcl
  variable "tmdb_secret_arn" {
    type        = string
    sensitive   = true
    description = "ARN of the Secrets Manager secret that stores the TMDB bearer token."
    validation {
      condition     = trimspace(var.tmdb_secret_arn) != ""
      error_message = "tmdb_secret_arn must not be blank."
    }
  }
  ```
- **`infra/locals.tf`**: Injects `TMDB_SECRET_ARN = var.tmdb_secret_arn` into `local.lambda_environment`.
- **`infra/iam.tf`**: Grants `secretsmanager:GetSecretValue` on the specified `tmdb_secret_arn`.

### 4.3 CI/CD Workflows (`.github/workflows/`)
- **`.github/workflows/ci.yml`**:
  - Sets `TMDB_API_TOKEN: "dummy_token_for_ci"` for unit and stub smoke tests.
  - The `live-e2e-gate` step checks for `${{ secrets.TMDB_API_TOKEN }}` to decide whether to execute live tests.
- **`.github/workflows/deploy-aws-proxy.yml`**:
  - Injects `TF_VAR_tmdb_secret_arn: ${{ secrets.TMDB_SECRET_ARN }}`.
  - Executes smoke test `scripts/smoke-aws-proxy.mjs` against deployed AWS stage URL.

---

## 5. Findings, Limitations & Identified Edge Cases

1. **Strict v4 Bearer Token Dependency**:
   - The entire proxy architecture assumes the token is a v4 Read Access Token (JWT).
   - If a developer copies the 32-character "API Key (v3 auth)" from their TMDB account dashboard instead of the "API Read Access Token (v4 auth)", all proxy requests to TMDB will fail with HTTP 401.
2. **Direct Upstream Status Pass-Through**:
   - In `server/tmdb-proxy-core.mjs`, when TMDB returns 401 (e.g. invalid bearer token), the proxy forwards the 401 status to the calling client. This can obscure whether the client was unauthenticated or the proxy's upstream credentials failed.
3. **Absence of Token Format Validation on Startup**:
   - Neither `server/movies-api.mjs` nor `server/tmdb-lambda.mjs` validates the format of the token on initialization; they only check `token.trim() !== ""`.

---

## 6. Recommendations & Best Practices

1. **Documentation Clarity**:
   - Explicitly document in `README.md` and `.env.template` that the required token is the **TMDB v4 API Read Access Token** (the long JWT starting with `eyJ...`), found under *Account Settings -> API -> API Read Access Token*.
2. **Optional Dual Token Support (Future Enhancement)**:
   - If desired, the proxy could detect whether the configured token is a 32-character hex key (`/^[0-9a-f]{32}$/i`) vs a JWT (`/^eyJ/`):
     - If 32-char hex: append `?api_key=${token}` to upstream requests.
     - If JWT: attach `Authorization: Bearer ${token}` header.
3. **Secret Validation in Secrets Manager**:
   - Ensure AWS Secrets Manager contains the raw JWT string without surrounding quotes or whitespace.
