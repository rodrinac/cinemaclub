# AWS TMDB Proxy Runbook

## Scope

Persistent deploy/ops notes for the AWS-hosted Movies API proxy.

## Architecture

- API Gateway REST API -> Node.js Lambda -> TMDB.
- Expo/web/mobile clients talk to the proxy via `EXPO_PUBLIC_MOVIES_API_URL`.
- Canonical client base URL after deploy is the Terraform output
  `movies_api_base_url` (`<stage invoke url>/api`).

## TMDB token rules

- Use the TMDB **v4 Read Access Token** (JWT starting with `eyJ`), not the
  legacy v3 API key.
- Local dev reads `TMDB_API_TOKEN` from `.env`.
- AWS reads `TMDB_SECRET_ARN`; the referenced Secrets Manager `SecretString`
  must be the raw token text, not JSON.
- If you use a customer-managed KMS key for that secret, the Lambda runtime
  role also needs `kms:Decrypt`.

## Secret rotation gotcha

- `server/tmdb-lambda.mjs` caches the fetched token in-memory for the life of
  a warm container.
- Rotating the Secrets Manager value does not invalidate already-warm Lambda
  containers. Force a cold start / redeploy before assuming the new token is
  active everywhere.
- If you use `aws lambda update-function-configuration --environment`, remember
  AWS replaces the entire `Variables` map. Pass the full map or use Terraform;
  never send a partial environment block.

## GitHub Actions production environment

Required environment secrets:

- `AWS_ROLE_TO_ASSUME`
- `TMDB_SECRET_ARN`

Required environment vars:

- `AWS_REGION`
- `TMDB_PROXY_SERVICE_NAME`
- `TMDB_PROXY_STAGE_NAME`
- `TMDB_PROXY_LOG_RETENTION_DAYS`

Optional vars:

- `TMDB_PROXY_CORS_ALLOW_ORIGIN`
- `TMDB_PROXY_RATE_LIMIT_RPS`
- `TMDB_PROXY_RATE_LIMIT_BURST`
- `TMDB_PROXY_ALARM_NOTIFICATION_ARN`
- `TMDB_PROXY_LAMBDA_ERROR_ALARM_THRESHOLD`
- `TMDB_PROXY_LAMBDA_THROTTLE_ALARM_THRESHOLD`
- `TMDB_PROXY_LAMBDA_DURATION_ALARM_THRESHOLD_MS`
- `TMDB_PROXY_API_5XX_ALARM_THRESHOLD`
- `TF_STATE_BUCKET`
- `TF_STATE_KEY`
- `TF_STATE_LOCK_TABLE`

OIDC notes:

- Role name: `cinemaclub-github-actions-production-deploy`
- Trust subject:
  `repo:rodrinac/cinemaclub:environment:production`
- API Gateway logging policy ARN must stay exactly
  `arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs`
- Terraform refresh/apply for this stack needs Lambda read/list permissions,
  including `lambda:ListVersionsByFunction`

## Terraform backend

Use the remote backend; do not rely on local runner state.

`infra/backend.hcl.example` currently documents:

```hcl
bucket         = "cinemaclub-tfstate-118462784293-euw1"
key            = "tmdb-proxy/prod/terraform.tfstate"
region         = "eu-west-1"
dynamodb_table = "cinemaclub-tf-locks"
encrypt        = true
```

Why this matters:

- local/ephemeral state causes duplicate-resource drift on fresh runners
- DynamoDB locking prevents concurrent state corruption
- destroy/redeploy is only reliable from the same persistent state

## Runtime behavior to preserve

- Canonical routes:
  - `GET /health`
  - `GET /api/movies/now-playing`
  - `GET /api/movies/popular`
  - `GET /api/movies/upcoming`
  - `GET /api/movies/:id`
  - `GET /api/search/movies?query=...`
  - `GET /api/genres`
- Keep compatibility aliases unless every caller/test is migrated together:
  `/api/movie/*`, `/api/search/movie`, `/api/genre/movie/list`
- Only successful TMDB responses are cached; keep
  `Cache-Control: public, max-age=60`
- 429 responses must include matching `Retry-After` and
  `parameters.retry_after`

## CORS and rate limiting

- CORS disabled when unset.
- When enabled, allow exactly one origin. No `*`, reflection, blank strings,
  or comma-separated lists.
- Rate limiting disabled when unset.
- `TMDB_PROXY_RATE_LIMIT_RPS` and `TMDB_PROXY_RATE_LIMIT_BURST` are a pair:
  set both or set neither.
- Lambda rate limiting is per warm container, not global.

## Smoke-test gotchas

- API Gateway stage throttling is distributed/best-effort, so `burst + 1`
  concurrent requests is not a reliable `429` assertion.
- `scripts/smoke-aws-proxy.mjs` intentionally does not exercise hosted rate
  limiting for this reason; it only checks that a normal request burst
  doesn't get an unexpected `429`. Verify rate-limit behavior manually or
  with a dedicated tool if needed.
- The smoke test step now runs before the movies API base URL is stored in
  Secrets Manager, so a failing smoke test blocks that secret update too.

## Useful outputs and logs

Important Terraform outputs:

- `movies_api_base_url`
- `stage_invoke_url`
- `rest_api_id`
- `stage_name`
- `lambda_function_name`
- `lambda_log_group_name`
- `api_access_log_group_name`
- `api_execution_log_group_name`
- `alarm_names`

Always-created log groups:

- `/aws/lambda/<function name>`
- `/aws/apigateway/<name-prefix>-access`
- `API-Gateway-Execution-Logs_<restApiId>/<stage>`

The deploy smoke checks also expect Lambda logs to show at least one
cache-hit event after a successful request.
