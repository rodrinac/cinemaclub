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
npm run audit:ci
```

## Refresh README screenshots (live mobile)

```sh
npm run build:web
npm run test:e2e:live -- tests/e2e/readme-screenshots.live.spec.ts
```

## Conventions

- Update `showcase/screenshot_01.png`, `showcase/screenshot_02.png`, and `showcase/screenshot_03.png` using Playwright capture only (no manual image edits).
- Keep the movie-details sample payload in `tests/e2e/fixtures/movie-details.example.json` as the canonical example for docs/tests.

## Cloudflare Worker Contract

- The production Movies API proxy is a Rust/WebAssembly Cloudflare Worker in
  `worker/` built with `worker-build` (`0.9.0`) and deployed via Wrangler.
  - Test: `cd worker && cargo test --locked`
  - Lint: `cd worker && cargo clippy --locked --all-targets -- -D warnings && cargo clippy --locked --target wasm32-unknown-unknown -- -D warnings`
  - Format: `cd worker && cargo fmt --check`
  - Deploy: `npm run worker:deploy`
- The Expo client talks only to the Movies API proxy via
  `EXPO_PUBLIC_MOVIES_API_URL`. For production deploys, point it at
  `https://<worker-host>/api`, never directly at `api.themoviedb.org`.
- Canonical routes are `GET /health`, `GET /api/movies/now-playing`,
  `GET /api/movies/popular`, `GET /api/movies/top-rated`,
  `GET /api/movies/upcoming`, `GET /api/movies/:id`,
  `GET /api/search/movies?query=...`, `GET /api/genres`, and
  `GET /api/movies/:id/pitch` (Workers AI-generated, no legacy alias). Keep
  legacy aliases (`/api/movie/*`,
  `/api/search/movie`, `/api/genre/movie/list`) unless you update every
  caller/test in the same change.
- `GET /share/movie/:id?lang=<BCP 47>` is the only non-JSON route: it serves
  escaped, server-rendered Open Graph/Twitter tags (TMDB details in the
  sharer's `lang`) for link-preview crawlers, then `meta refresh`es to
  `<SHARE_APP_ORIGIN>/movie/:id`. `SHARE_APP_ORIGIN` defaults to
  `CORS_ALLOW_ORIGIN`; with neither set the route is `503`. The app's Share
  button builds these links from `EXPO_PUBLIC_MOVIES_API_URL` (sibling of
  `/api`); the viewer's own locale still drives the app itself.
- Keep the proxy read-only: GET only plus conditional `OPTIONS` preflight
  when CORS is configured. Unknown/duplicate query params and unsafe paths
  are `400`; unknown routes are `404`; upstream/network failures are `502`.
- Outbound TMDB requests must be descriptor-built and pinned to
  `https://api.themoviedb.org/3/`, with redirect errors enabled. Never forward
  inbound auth, cookies, or arbitrary headers upstream.
- Home tabs are Now / Top Rated / Upcoming (Now is the default). Top Rated
  and Upcoming are built on TMDB `discover/movie` with server-fixed filters;
  clients can only add `region` (ISO 3166-1 alpha-2) on now-playing and
  upcoming. `popular` is no longer used by the app but stays for the smoke test
  and other callers.
- Cache only successful TMDB responses. Preserve
  `Cache-Control: public, max-age=60`.
- Workers AI is the only other outbound call: the pitch route sends TMDB facts
  (never client input beyond the movie id and `language`) to the `AI` binding
  (default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, override via
  `PITCH_MODEL`), with JSON-schema structured output and validated/sanitized
  output. Pitch cache misses are always rate limited per client via
  `PITCH_RATE_LIMITER` because each one costs a model call. See
  `docs/cloudflare-worker-runbook.md`.

## TMDB Auth and Retry Notes

- `TMDB_API_TOKEN` (`.env` locally, Cloudflare Worker secret in production)
  must be the TMDB v4 Read Access Token (JWT starting with `eyJ`), not the
  32-char v3 API key. Client code must never send TMDB creds or API keys.
- 429s are a contract: responses include both `Retry-After` and
  `parameters.retry_after`, and they must match. Client retry logic should
  prefer the header and fall back to the body.

## Cloudflare & Web Deployment

- Cloudflare Workers Builds deploys the Worker on every release commit pushed
  to `main` (watching `package.json` and running `npm run worker:deploy`).
  `scripts/version-bump.mjs` keeps `package.json`, `package-lock.json`,
  `app.json`, `worker/Cargo.toml`, and `worker/Cargo.lock` in sync.
- Web workflow: `.github/workflows/deploy.yml`. It deploys from the GitHub
  environment `production`, gates execution with `verify-release`, verifies
  live Worker `/health` and CORS against `vars.MOVIES_API_URL`, sets
  `EXPO_PUBLIC_MOVIES_API_URL` in EAS `production`, runs
  `npm run build:web:production`, and publishes with `eas deploy --prod`.
- Required `production` secret: `EXPO_TOKEN`.
- Required `production` vars: `MOVIES_API_URL`, `TMDB_PROXY_CORS_ALLOW_ORIGIN`.
- CORS is disabled when unset. When enabled it must be one exact origin;
  never use `*`, reflection, blank strings, or comma-separated lists.
- See `docs/cloudflare-worker-runbook.md` for the deploy/ops checklist.

## Expo and TypeScript Maintenance

- Use Node 22.13+ (Expo SDK 58 minimum); `npm run api` depends on `node --env-file` and built-in
  `fetch`.
- `tsconfig.json` currently keeps `baseUrl: "."` and
  `paths["@/*"] = ["src/*"]`. `ignoreDeprecations` is compiler-version
  specific; with TypeScript 5.8.x the valid value is `"5.0"`, not `"6.0"`.
  Re-check it whenever TypeScript is upgraded.
- `ios/` and `android/` are gitignored and generated by Expo prebuild (CNG)
  from `app.json` and `assets/`. Put native settings in app config or config
  plugins, never in those folders.
- App icon, adaptive icon, splash, favicons and the in-app placeholder art are
  rendered from the SVG sources in `assets/brand/` by `npm run brand:assets`.
  Edit the SVGs and rerun it; don't hand-edit the PNGs.
- Device-local persistence still lives in `expo-sqlite`. If the project ever
  adds shared/synced user data, put Prisma/Postgres behind a server API only;
  never ship DB URLs or Prisma credentials in `EXPO_PUBLIC_*`.
