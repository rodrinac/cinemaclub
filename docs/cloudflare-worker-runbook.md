# Cloudflare Worker Runbook

## Scope

Persistent deploy/ops notes for the Cloudflare Worker Movies API proxy (`worker/`).

## Architecture

- Cloudflare Worker (`worker/`, written in Rust and compiled to WebAssembly via `worker-build`) -> TMDB.
- The movie pitch route (`GET /api/movies/:id/pitch`) calls Cloudflare Workers AI through the `AI` binding (default model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, overridable with the `PITCH_MODEL` Worker var) using JSON-schema structured output.
- Expo web/mobile clients talk only to the Worker via `EXPO_PUBLIC_MOVIES_API_URL` (`https://<worker-host>/api`).

## TMDB token rules

- Use the TMDB **v4 Read Access Token** (JWT starting with `eyJ`), not the legacy v3 API key.
- Local dev (`npm run api`) reads `TMDB_API_TOKEN` from `.env`.
- Production reads `TMDB_API_TOKEN` from a Cloudflare Worker secret:

  ```sh
  cd worker && npx wrangler secret put TMDB_API_TOKEN
  ```

## Cloudflare Workers Builds

Workers Builds deploys the Worker on every release commit pushed to `main` (it cannot trigger on git tags):

- **Root directory**: `/`
- **Build command**: *(leave empty)*
- **Deploy command**: `npm run worker:deploy`
- **Include paths**: `package.json` (leave exclude paths empty). The version-bump PR always edits `package.json` together with `worker/Cargo.toml`, so only release commits trigger a Worker deploy.

`scripts/worker-deploy.mjs` installs Rust (`wasm32-unknown-unknown`) and `worker-build` `0.9.0` when not already on `PATH`, builds the release Wasm bundle, and runs `wrangler deploy`.

## GitHub Actions production environment

GitHub Actions does not deploy the Worker; `.github/workflows/deploy.yml` publishes the Expo web app to EAS Hosting after a GitHub Release is created.

Required `production` environment secret:

- `EXPO_TOKEN`

Required `production` environment vars:

- `MOVIES_API_URL` — the Worker's `/api` base URL (e.g. `https://cinemaclub-tmdb-proxy.<account-subdomain>.workers.dev/api`)
- `TMDB_PROXY_CORS_ALLOW_ORIGIN` — exact deployed web origin (e.g. `https://cinemaclub.expo.app`)

## Runtime behavior to preserve

- Canonical routes:
  - `GET /health` (returns `{"status":"ok","version":"<x.y.z>"}` from `worker/Cargo.toml`)
  - `GET /api/movies/now-playing`
  - `GET /api/movies/popular`
  - `GET /api/movies/top-rated` (discover, `vote_average.desc` with `vote_count.gte=5000`)
  - `GET /api/movies/upcoming` (discover with a release-date floor of tomorrow; with `region`, regional theatrical releases plus a one-year primary-release floor)
  - `GET /api/movies/:id`
  - `GET /api/search/movies?query=...`
  - `GET /api/genres`
  - `GET /api/movies/:id/pitch` (Workers AI, no legacy alias)
  - `GET /share/movie/:id?lang=...` (escaped HTML Open Graph/Twitter preview page redirecting to `<SHARE_APP_ORIGIN>/movie/:id`)
- Compatibility aliases: `/api/movie/*`, `/api/search/movie`, `/api/genre/movie/list`.
- Only successful TMDB responses are cached (`Cache-Control: public, max-age=60`).
- 429 responses include matching `Retry-After` header and `parameters.retry_after` JSON field.

## Rate limiting and CORS

- `RATE_LIMITER` (50 req / 10 s per `CF-Connecting-IP`, namespace `2001`) applies to cache misses on API and share routes.
- `PITCH_RATE_LIMITER` (5 req / 60 s per `CF-Connecting-IP`, namespace `2002`) applies to pitch cache misses on top of `RATE_LIMITER`.
- `CORS_ALLOW_ORIGIN` is configured in `worker/wrangler.jsonc` and must be a single exact origin (never `*` or a comma-separated list). `SHARE_APP_ORIGIN` defaults to `CORS_ALLOW_ORIGIN`.

## Local development and testing

```sh
# Rust Worker unit tests & lints
cd worker
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo clippy --locked --target wasm32-unknown-unknown -- -D warnings
cargo test --locked

# Dry-run Worker build + bundle check
npm run worker:deploy -- --dry-run --outdir ../build/worker-dry-run

# Smoke-test a live Worker
SMOKE_API_ORIGIN=https://<worker-host> SMOKE_CORS_ALLOW_ORIGIN=https://cinemaclub.expo.app node scripts/smoke-worker.mjs
```
