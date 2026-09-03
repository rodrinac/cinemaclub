# AGENTS

Quick guidance for contributors/agents.

## Quick start

```sh
npm install
npm run api
npm start
npm run build:web
```

## Tests

```sh
npm run test
npm run test:e2e:stub
npm run test:e2e:live
```

## Refresh README screenshots (live mobile)

```sh
npm run build:web
npm run test:e2e:live -- tests/e2e/readme-screenshots.live.spec.ts
```

## Conventions

- Update `showcase/screenshot_01.png`, `showcase/screenshot_02.png`, and `showcase/screenshot_03.png` using Playwright capture only (no manual image edits).
- Keep the movie-details sample payload in `tests/e2e/fixtures/movie-details.example.json` as the canonical example for docs/tests.

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

## TMDB Proxy Contract

- The Expo client talks only to the Movies API proxy via
  `EXPO_PUBLIC_MOVIES_API_URL`. For AWS deploys, point it at
  `<stage invoke url>/api`, never directly at `api.themoviedb.org`.
- Canonical routes are `GET /health`, `GET /api/movies/now-playing`,
  `GET /api/movies/popular`, `GET /api/movies/upcoming`,
  `GET /api/movies/:id`, `GET /api/search/movies?query=...`, and
  `GET /api/genres`. Keep legacy aliases (`/api/movie/*`,
  `/api/search/movie`, `/api/genre/movie/list`) unless you update every
  caller/test in the same change.
- Keep the proxy read-only: GET only plus conditional `OPTIONS` preflight
  when CORS is configured. Unknown/duplicate query params and unsafe paths
  are `400`; unknown routes are `404`; upstream/network failures are `502`.
- Outbound TMDB requests must be descriptor-built and pinned to
  `https://api.themoviedb.org/3/`, with `redirect: "error"`. Never forward
  inbound auth, cookies, or arbitrary headers upstream.
- Cache only successful TMDB responses. Preserve
  `Cache-Control: public, max-age=60`.

## TMDB Auth and Retry Notes

- `TMDB_API_TOKEN` and the AWS secret value must be the TMDB v4 Read Access
  Token (JWT starting with `eyJ`), not the 32-char v3 API key. The secret
  value must be the raw plaintext token string, not JSON.
- Local dev reads `TMDB_API_TOKEN` from `.env`; AWS reads `TMDB_SECRET_ARN`
  from Secrets Manager. Client code must never send TMDB creds or API keys.
- `server/tmdb-lambda.mjs` caches the resolved TMDB token in-memory for the
  life of a warm Lambda container. After rotating the secret, force a cold
  start / redeploy before assuming the new token is live.
- 429s are a contract: responses include both `Retry-After` and
  `parameters.retry_after`, and they must match. Client retry logic should
  prefer the header and fall back to the body.

## AWS TMDB Proxy Deployment

- Main workflow: `.github/workflows/deploy-aws-proxy.yml`. It deploys from
  the GitHub environment `production`, keeps the proxy and web release in one
  serialized workflow, and runs `deploy-web` only after the proxy deploy and
  smoke test succeed.
- Required `production` secrets: `AWS_ROLE_TO_ASSUME`, `TMDB_SECRET_ARN`,
  `EXPO_TOKEN`.
- Required `production` vars: `AWS_REGION`, `TMDB_PROXY_SERVICE_NAME`,
  `TMDB_PROXY_STAGE_NAME`, `TMDB_PROXY_CORS_ALLOW_ORIGIN`,
  `TMDB_PROXY_LOG_RETENTION_DAYS`.
- Optional deploy vars: `TMDB_PROXY_RATE_LIMIT_RPS`,
  `TMDB_PROXY_RATE_LIMIT_BURST`, and the `TMDB_PROXY_*ALARM*` thresholds.
- GitHub OIDC deploy role name:
  `cinemaclub-github-actions-production-deploy`. Trust subject:
  `repo:rodrinac/cinemaclub:environment:production`.
- `deploy-web` must discover the live proxy URL from AWS API Gateway by the
  deterministic name
  `<TMDB_PROXY_SERVICE_NAME>-<TMDB_PROXY_STAGE_NAME>-rest-api`, then set
  `EXPO_PUBLIC_MOVIES_API_URL=https://<stage invoke url>/api` in the EAS
  `production` environment before `npm run build:web:production` and
  `eas deploy --prod`. Do not read Terraform remote state in that web job.
- Exact API Gateway log policy ARN:
  `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`.
  Keep `aws_api_gateway_account.this` dependent on that attachment. The
  deploy role also needs Lambda read actions like
  `lambda:ListVersionsByFunction` for Terraform refresh/apply, plus
  `apigateway:GET` for the web job's REST API lookup.
- See `docs/aws-tmdb-proxy-runbook.md` for the longer deploy/ops checklist.

## Terraform and Smoke-Test Gotchas

- Terraform state is remote S3, not local runner state. Use
  `infra/backend.hcl.example` / workflow backend vars:
  `cinemaclub-tfstate-118462784293-euw1`,
  `tmdb-proxy/prod/terraform.tfstate`, `eu-west-1`,
  `cinemaclub-tf-locks`. Never let CI fall back to local/ephemeral state.
- CORS is disabled when unset. When enabled it must be one exact origin;
  never use `*`, reflection, blank strings, or comma-separated lists.
- Rate limiting is disabled when unset. Set RPS and burst together or clear
  both.
- API Gateway stage throttling is distributed/best-effort. Do not write
  smoke tests that expect `burst + 1` concurrent requests to deterministically
  yield a `429`; `scripts/smoke-aws-proxy.mjs` deliberately skips asserting
  hosted rate-limit behavior for this reason and only checks that a normal
  request burst succeeds.
- PR CI validates Terraform with `init -backend=false` and placeholder AWS
  settings. The deploy workflow relies on the runner's `aws` CLI; if future
  PR CI needs AWS CLI commands, add explicit setup/version checks.

## Expo and TypeScript Maintenance

- Use Node 22+; `npm run api` depends on `node --env-file` and built-in
  `fetch`.
- `tsconfig.json` currently keeps `baseUrl: "."` and
  `paths["@/*"] = ["src/*"]`. `ignoreDeprecations` is compiler-version
  specific; with TypeScript 5.8.x the valid value is `"5.0"`, not `"6.0"`.
  Re-check it whenever TypeScript is upgraded.
- `ios/` and `android/` are tracked. Do not do a blind CNG /
  `expo prebuild --clean` migration without first moving intentional native
  settings into app config/config plugins.
- Device-local persistence still lives in `expo-sqlite`. If the project ever
  adds shared/synced user data, put Prisma/Postgres behind a server API only;
  never ship DB URLs or Prisma credentials in `EXPO_PUBLIC_*`.
