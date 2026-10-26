# AWS TMDB Proxy Runbook

## Scope

Persistent deploy/ops notes for the AWS-hosted Movies API proxy.

## Architecture

- API Gateway REST API -> Node.js Lambda -> TMDB.
- The movie pitch route additionally calls Amazon Bedrock (Converse API)
  through the cross-region inference profile in Terraform `pitch_model_id`
  (default `eu.anthropic.claude-haiku-4-5-20251001-v1:0`).
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
- `EXPO_TOKEN` for the serialized `deploy-web` Expo Hosting release job

Required environment vars:

- `AWS_REGION`
- `TMDB_PROXY_SERVICE_NAME`
- `TMDB_PROXY_STAGE_NAME`
- `TMDB_PROXY_CORS_ALLOW_ORIGIN`
- `TMDB_PROXY_LOG_RETENTION_DAYS`

Optional vars:

- `TMDB_PROXY_RATE_LIMIT_RPS`
- `TMDB_PROXY_RATE_LIMIT_BURST`
- `TMDB_PROXY_ALARM_NOTIFICATION_ARN`
- `TMDB_PROXY_LAMBDA_ERROR_ALARM_THRESHOLD`
- `TMDB_PROXY_LAMBDA_THROTTLE_ALARM_THRESHOLD`
- `TMDB_PROXY_LAMBDA_DURATION_ALARM_THRESHOLD_MS`
- `TMDB_PROXY_API_5XX_ALARM_THRESHOLD`
- Existing GitHub Actions backend vars used by the Terraform deploy job:
  `TF_STATE_BUCKET`, `TF_STATE_KEY`, `TF_STATE_LOCK_TABLE`

OIDC notes:

- Role name: `cinemaclub-github-actions-production-deploy`
- Trust subject:
  `repo:rodrinac/cinemaclub:environment:production`
- The deploy role keeps the existing Terraform permissions and needs only one
  extra read permission for the web job's API discovery:
  `apigateway:GET` on `arn:aws:apigateway:${AWS_REGION}::/restapis/*`. If AWS
  rejects resource scoping for `GetRestApis`, relax only that statement to
  `Resource: "*"`.
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
  - `GET /api/movies/popular` (not used by the app tabs)
  - `GET /api/movies/top-rated` (discover, `vote_average.desc` with
    `vote_count.gte=5000`; TMDB's own `top_rated` lets low-vote new releases
    outrank the classics)
  - `GET /api/movies/upcoming` (discover with a release-date floor of
    tomorrow; with `region`, regional theatrical releases plus a one-year
    primary-release floor to drop re-releases)
  - `GET /api/movies/:id`
  - `GET /api/search/movies?query=...`
  - `GET /api/genres`
  - `GET /api/movies/:id/pitch` (no legacy alias)
  - `GET /share/movie/:id?lang=...` (HTML link-preview page, see below)
- Keep compatibility aliases unless every caller/test is migrated together:
  `/api/movie/*`, `/api/search/movie`, `/api/genre/movie/list`
- Only successful TMDB responses are cached; keep
  `Cache-Control: public, max-age=60`
- 429 responses must include matching `Retry-After` and
  `parameters.retry_after`

## Share pages (link previews)

- The web app is a client-rendered SPA, so crawlers (WhatsApp, iMessage,
  Slack, X, Facebook) only ever see the generic `index.html` tags. Shared
  links therefore point at `<stage invoke url>/share/movie/:id?lang=<tag>`,
  which renders the movie's title, overview and TMDB backdrop as Open Graph
  and Twitter tags in the sharer's language, then `meta refresh`es people to
  `<SHARE_APP_ORIGIN>/movie/:id`.
- `SHARE_APP_ORIGIN` (Lambda env) defaults to `CORS_ALLOW_ORIGIN`, which is
  the deployed web app, so no extra deploy variable is needed. Only `lang` is
  accepted; it is mapped to TMDB `language` upstream.
- Pages are cached like other successful responses
  (`Cache-Control: public, max-age=60`) and served with
  `Content-Security-Policy: default-src 'none'; img-src https:`. Every TMDB
  string is HTML-escaped. TMDB `404` renders a generic page redirecting to `/`
  (status `404`); upstream failures render a generic page redirecting to the
  movie (status `502`), so a tapped link always lands in the app.
- `og:url`/canonical are deliberately omitted: Facebook re-scrapes `og:url`,
  and the app URL only has the generic tags. Links use the raw `execute-api`
  host until a custom domain is set up.

## Movie pitches (Bedrock)

- `GET /api/movies/:id/pitch` fetches TMDB details with a server-fixed
  `append_to_response=keywords,credits,release_dates`, then asks Bedrock for a
  spoiler-free pitch through a forced `submit_pitch` tool call. The model gets
  keywords, directors, writers, top cast, the audience rating (50+ votes only)
  and the certification for the `language` region (US fallback). The overview
  is deliberately not sent: the app shows it above the pitch and Haiku tends
  to paraphrase it. The prompt forbids outside knowledge (other titles such as
  "from the directors of ...", awards, sales, unsupported praise); a live
  check showed a general "use only the facts" rule was not enough. TMDB
  reviews are deliberately excluded (spoilers, third-party text). Output is
  length-checked and stripped of control characters before it is returned.
- Responses are cached per movie and `language` for 24 hours per warm
  container. Cache misses are always throttled per client (burst 5, one
  refill every 5 seconds), on top of the optional proxy-wide rate limit.
- `pitch_model_id = null` removes `BEDROCK_PITCH_MODEL_ID` and the Bedrock IAM
  statements; the route then returns `503`. Local `npm run api` has no Bedrock
  client, so the route is `503` there too.
- Claude models need the account's one-time Anthropic use case form in the
  Bedrock console. Until it is submitted, generation fails and the route
  returns `502`; the client hides the card.
- Lambda IAM allows `bedrock:InvokeModel` on the inference profile, and on the
  foundation model only when `bedrock:InferenceProfileArn` is that profile.

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

## EAS client URL wiring

- The production GitHub Actions workflow stays serialized in
  `.github/workflows/deploy-aws-proxy.yml`: `verify-release` verifies a GitHub
  release was published for the triggering commit, `deploy` applies Terraform and
  smoke-tests the proxy, then `deploy-web` resolves the live API Gateway REST
  API ID from AWS, updates EAS, exports the web app, and deploys Expo Hosting
  production. All checkout steps pin `ref: ${{ github.event.workflow_run.head_sha || github.sha }}`.
- The web job must not read Terraform remote state. It derives
  `EXPO_PUBLIC_MOVIES_API_URL` from the live API Gateway control-plane lookup
  using the deterministic REST API name
  `<TMDB_PROXY_SERVICE_NAME>-<TMDB_PROXY_STAGE_NAME>-rest-api`.
- Set the resolved `https://<rest-api-id>.execute-api.<AWS_REGION>.amazonaws.com/<stage>/api`
  value in the EAS `production` environment for production builds:

  ```sh
  eas env:set production \
    --name EXPO_PUBLIC_MOVIES_API_URL \
    --value https://<stage invoke url>/api \
    --visibility plaintext \
    --scope project
  ```

- If you add preview builds, set the matching preview proxy URL in the EAS
  `preview` environment too.
- Rebuild app binaries after changing the EAS environment variable so the
  updated public URL is embedded in the client bundle.
- For SDK 53 OTA parity, publish with the matching environment:
  `eas update --environment production` (or `preview` when applicable).
