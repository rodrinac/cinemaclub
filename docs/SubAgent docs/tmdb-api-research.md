# TMDB API AWS implementation handoff

Date: 2026-09-02
Scope: AWS-hosted replacement for the current local TMDB proxy. This report is the implementation handoff; it does not change application code.

## Confirmed requirements

1. The target is an AWS-hosted API. The required request path is **API Gateway REST API -> Node.js Lambda -> TMDB**.
2. CORS is controlled by a Terraform/build-pipeline variable. If that variable is absent, **no CORS response header may be emitted**.
3. The in-memory rate limiter is likewise opt-in through a Terraform/build-pipeline variable. Its disabled behavior and production default are specified below.
4. Terraform must provision the production concerns in this report, and post-deployment smoke tests must assert them.

The original spec's Python Lambda, `/movies/popular`-only scope, mandatory API key/usage plan, and default CORS are superseded where they conflict with the confirmed requirements or current client compatibility.

## Current source facts

| Area | Current source evidence | Handoff impact |
| --- | --- | --- |
| Server/runtime | `server/movies-api.mjs:1-8,301-386` is a Node HTTP server, launched by `package.json:9-23` through `npm run api`. | Move the route/validation logic into a Node Lambda handler; preserve local execution separately if still needed. |
| Client base URL | `src/api/tmdb/baseUrl.ts:1-5,56-96` builds an `/api` base URL and rejects TMDB hosts. | Set `EXPO_PUBLIC_MOVIES_API_URL` to the deployed API's stage URL plus `/api`; do not point the client at TMDB. |
| Client authentication | `src/api/tmdb/index.ts:29-39` sets content-negotiation headers only; it sends neither `x-api-key` nor a TMDB token. | The hosted API must remain anonymously callable by this client. Do not reintroduce the original spec's client API-key requirement without a coordinated client-contract change. |
| Secret handling | `.env.template:1-5`, `server/movies-api.mjs:7-12,289-295`, and `README.md:21-29` keep `TMDB_API_TOKEN` server-side locally. | Production must retrieve the same bearer token from Secrets Manager, never from a public build variable or client bundle. |
| Routes | `server/movies-api.mjs:29-40,170-180,347-380`; canonical client paths are in `src/api/tmdb/discover.ts:1-11`, `src/pages/SearchMovie/index.tsx`, `src/pages/SearchFilters/index.tsx`, and `src/pages/MovieDetail/index.tsx`. | Preserve all canonical routes and the aliases while clients/tests still depend on them. |
| Input and upstream boundary | `server/movies-api.mjs:117-265,268-299` rejects traversal and invalid/duplicate query fields and pins requests to TMDB's HTTPS `/3/` origin. | Port these controls without widening the allow-list. |
| Limiting/CORS today | `server/movies-api.mjs:59-115,301-326` unconditionally enables an IP token bucket and emits wildcard CORS. | These current defaults conflict with the confirmed conditional configuration and must change. |
| Tests/CI | `tests/api.test.ts:42-89` covers health, input errors, and basic limiting. `.github/workflows/ci.yml:26-47,59-104` runs lint, typecheck, build, Jest, stub E2E, plus token-gated live E2E. | Add Lambda/Terraform contract and deployed-smoke coverage. |

## Hosted API contract

### Routes and compatibility

API Gateway uses the deployed stage prefix followed by `/api`; Lambda receives and serves:

| Canonical route | TMDB target | Query policy |
| --- | --- | --- |
| `GET /api/movies/now-playing` | `/3/movie/now_playing` | `language`, `include_adult`, `page` |
| `GET /api/movies/popular` | `/3/movie/popular` | `language`, `include_adult`, `page` |
| `GET /api/movies/upcoming` | `/3/movie/upcoming` | `language`, `include_adult`, `page` |
| `GET /api/movies/:id` | `/3/movie/:id` | `language`, `include_adult`, `append_to_response` |
| `GET /api/search/movies` | `/3/search/movie` | above search fields, with required `query` |
| `GET /api/genres` | `/3/genre/movie/list` | `language`, `include_adult` |
| `GET /health` | none | none |

Keep the current compatibility aliases: `/api/movie/now_playing`, `/api/movie/popular`, `/api/movie/upcoming`, `/api/movie/:id`, `/api/search/movie`, and `/api/genre/movie/list`. They must have identical validation and responses. Continue the existing rules: GET only (plus conditional `OPTIONS` below), unknown or duplicate query parameters are `400`, unsafe paths are `400`, unsupported routes are `404`, TMDB status/body are propagated where valid, and unexpected upstream failures are `502` without internals.

The Lambda constructs the upstream URL from descriptors, never from user-supplied host/path input; sends `Accept: application/json` and `Authorization: Bearer <server secret>`; rejects redirects; and **does not forward inbound `Authorization`, cookies, or arbitrary headers**. No client API key is part of this compatible contract.

### CORS: exact conditional semantics

Use a nullable Terraform input named `cors_allow_origin` (`string`, default `null`) and pass it as Lambda configuration. The deployment pipeline supplies a single exact allowed origin only when browser cross-origin access is intended. Empty or whitespace-only values are invalid configuration, not an enabled wildcard.

* **Absent/null:** CORS is disabled. Every Lambda response—success, validation error, throttling error, upstream error, and API Gateway-generated error—contains **no** `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Credentials`, `Access-Control-Expose-Headers`, or `Vary: Origin`. API Gateway GatewayResponse resources and stage settings must not inject them. `OPTIONS` is not advertised; it returns the normal method/route rejection with no CORS headers.
* **Present:** accept a CORS preflight only for supported paths; return `204` with `Access-Control-Allow-Origin: <cors_allow_origin>`, `Access-Control-Allow-Methods: GET, OPTIONS`, and `Access-Control-Allow-Headers: Content-Type`. Add `Access-Control-Allow-Origin: <cors_allow_origin>` and `Vary: Origin` to every Lambda response for supported requests, including `429`. Do not set credentials and do not allow `Authorization` or `x-api-key`.
* Do not use `*`, origin reflection, or a comma-separated origin variable. Multiple origins require an explicit future allow-list design.

### Conditional in-memory limiting

Use nullable Terraform inputs `rate_limit_rps` and `rate_limit_burst`; both must be set together or both absent. Positive finite values are required, and `burst >= 1`. Pass only configured values to Lambda.

* **Absent/null:** no bucket state is created and no request receives a locally generated `429`; Lambda performs no in-memory rate limiting.
* **Present:** before any TMDB-backed route invokes TMDB, apply a token bucket per client key. Capacity is `rate_limit_burst`; initially full; tokens refill continuously at `rate_limit_rps` per second, capped at capacity; one token is consumed for each allowed request; there is no queue. A request with fewer than one token gets `429`, `Retry-After: ceil((1 - tokens) / rate_limit_rps)` clamped to at least `1`, and body `{ "error": "Too many requests. Please retry shortly.", "parameters": { "retry_after": <integer> } }`. Health checks are excluded so load balancers are not throttled.
* Client key: use the first comma-separated `X-Forwarded-For` value only when API Gateway supplies it from its trusted request context; otherwise use the API Gateway source IP. Never trust an arbitrary client-provided header directly.
* This is per warm Lambda execution environment, resets on cold start, and is not a global or multi-concurrency limit. It protects individual upstream calls but cannot substitute for a distributed limit.

**Safe production baseline:** because absence explicitly disables limiting, production deployments should either leave both values unset or set both together. `rate_limit_rps = 5` and `rate_limit_burst = 5` remain a recommended baseline when enabling the limiter, and Terraform plus the deployment job must fail if exactly one is configured. If enforceable aggregate protection is later required, add an API Gateway/WAF or distributed limiter; do not claim the in-memory limiter is globally exact.

The client currently spaces only queued detail calls and reads retry delay from `error.response.data.parameters.retry_after` (`src/api/tmdb/getQueued.ts:4-7,67-83`). Preserve that body field; additionally teach the retry helper to prefer the standard `Retry-After` header. Apply the common retry behavior to all TMDB calls or document why a route is excluded.

## Terraform and secret model

Create an isolated Terraform root (for example, `infra/`) using Terraform >= 1.6 and the AWS and archive providers. No account IDs, regions, resource names, secret values, or origins are hard-coded. Required variable contract:

| Variable | Type / sensitivity | Purpose |
| --- | --- | --- |
| `aws_region` | `string` | Deployment region, supplied by environment/pipeline. |
| `tmdb_secret_arn` | `string`, sensitive | ARN of an existing Secrets Manager secret containing only the TMDB bearer token. Terraform never reads, outputs, or stores the token. |
| `cors_allow_origin` | nullable `string`, default `null` | Exact browser origin; governs the CORS behavior above. |
| `rate_limit_rps`, `rate_limit_burst` | nullable `number`, default `null` | Enables the paired in-memory limiter only when both exist. Leave both unset to disable it, or set both together (for example `5` / `5`) to enable it. |
| `log_retention_days` | `number` | CloudWatch retention, validated to an approved positive retention value. |
| alarm configuration inputs | numbers/notification ARN as appropriate | Alarm thresholds and optional notification target; no fabricated recipient or threshold. |

Terraform provisions:

1. A Node.js Lambda package from the API handler and required runtime dependencies, with a bounded timeout (the original 10-second TMDB timeout is a suitable maximum), constrained memory, environment variables for the secret ARN and optional CORS/rate settings, and a dedicated CloudWatch log group with retention.
2. A least-privilege Lambda role: CloudWatch Logs write access scoped to its log group and `secretsmanager:GetSecretValue` scoped only to `tmdb_secret_arn`. The Lambda obtains and caches the secret in process memory; it never logs it. Do not use plaintext `tmdb_token` Terraform variables, Lambda environment values, outputs, state, or CI logs.
3. An API Gateway **REST API**, resources/methods for the table above (a greedy proxy may be used only if Lambda still enforces the exact route allow-list), Lambda proxy integration, invoke permission scoped to that API, deployment trigger based on API integration/method changes, and a named stage. Configure stage access logging to a dedicated retained log group and execution logs without request headers or secrets.
4. CloudWatch metric alarms for Lambda errors/throttles/duration and API Gateway 5XX responses, with thresholds and notification behavior exposed as variables. Enable tracing only if its permissions/retention are explicitly provisioned.
5. Tags/standard metadata through a non-account-specific `tags` map. Provide `terraform.tfvars.example` containing placeholders only, and ignore real tfvars/state artifacts according to the repository's state-management policy.

Cache only successful, validated TMDB GET responses. Set `Cache-Control: public, max-age=60` and use a bounded in-memory TTL/LRU cache keyed by canonical route plus normalized allowed query fields. Never cache `400`, `429`, `5xx`, or secret-bearing data. Cache hit/miss and upstream latency belong in structured logs. A shared cache is a future scaling decision, not a claim of cross-instance caching.

## Source-change sequence

1. Extract the pure route matching, parameter validation, safe URL construction, response formatting, and conditional CORS/limiter functions from `server/movies-api.mjs`; adapt them to API Gateway REST proxy events and Lambda responses. Preserve the Node 22-compatible runtime (`package.json:6-8`).
2. Implement secret retrieval, strict outbound timeout/abort handling, normalized-response cache, structured redacted logs, and the response/error behavior above. Ensure `Retry-After` is both header and body compatible.
3. Preserve or provide a local adapter so `npm run api`, `.env.template`, and existing development workflow remain functional until deliberately retired. It continues to use local `TMDB_API_TOKEN`; AWS uses the secret ARN model.
4. Add Terraform resources/variables/outputs. Output only the stage API URL and non-secret operational identifiers; never output token values.
5. Update client deployment configuration to use the stage URL plus `/api`; update `getQueued` to honor the header and keep the body fallback. Do not add client secrets or API-key headers.
6. Add focused tests, then wire Terraform validation/package checks into CI. Keep existing Jest, stub Playwright, and token-gated live E2E checks intact.

## Tests, CI, and post-deploy smoke tests

Unit/contract tests must cover canonical routes and aliases, query/path rejection, upstream URL pinning, token non-disclosure, timeout/`502`, cache hit/miss/expiry, and the complete limiter algorithm (initial burst, refill, no queue, trusted client key, excluded health route, `429` header and body).

Test the CORS matrix for every response class: when `cors_allow_origin` is set, correct exact-origin headers/preflight; when absent, assert each forbidden CORS header is absent from Lambda and Gateway error responses. Add Terraform `fmt -check`, `validate`, and a plan/package test with placeholder inputs; do not apply infrastructure in ordinary PR CI. Continue the current CI checks documented in `.github/workflows/ci.yml:26-47`.

The deployment pipeline runs post-deploy smoke tests against the stage URL using only non-secret configuration:

1. `GET /health` returns `200` and `{ "status": "ok" }`.
2. A valid canonical request reaches TMDB and returns JSON plus `Cache-Control: public, max-age=60`; repeat it to confirm a cache-hit metric/log (not a response-secret assertion).
3. Invalid query/path and unsupported method return their expected safe `400`/`405` responses without internals.
4. With CORS configured, validate allowed-origin GET and preflight headers; with CORS absent, assert all listed CORS headers are absent for health, validation errors, and Gateway-generated errors.
5. With limiting configured, issue `burst + 1` TMDB-backed requests under one trusted test client context and assert at least one `429`, integral `Retry-After >= 1`, and matching `parameters.retry_after`; confirm health remains available. With limiting absent, assert no locally generated `429` over the equivalent controlled burst.
6. Confirm CloudWatch log groups, API Gateway stage logging, and configured alarms exist; inspect logs/outputs only for identifiers and redacted structured fields, never tokens.

## Acceptance criteria

- API Gateway REST API invokes the Node Lambda for all listed routes; the Expo client works by configuring only its public API base URL.
- TMDB bearer token is server-only: local `.env` for development and Secrets Manager for AWS; it is absent from Terraform state/outputs, client bundles, logs, and responses.
- Canonical routes, aliases, validation, error behavior, and direct-TMDB rejection remain client-compatible.
- CORS and local limiting exactly follow their absent/present contracts, including the pipeline's paired rate-limit enable/disable behavior.
- Terraform creates the API, Lambda, least-privilege secret/log access, retained logs, stage access logging, and configurable operational alarms without account-specific values.
- Successful cached responses, resilience controls, redacted observability, CI validation, and all post-deploy smoke assertions above pass.

## Unavoidable future decisions

Only these decisions remain outside the confirmed scope: the existing AWS region and secret ARN, the exact allowed browser origin (or intentionally absent CORS), log retention/alarm thresholds and notification destination, stage naming/tags, and whether future multi-instance/global throttling needs a managed distributed control.
