# Migration Implementation Handoff

## Scope and current snapshot

Finish the uncommitted Expo SDK 53, web, and server-side TMDB-token migration. `HEAD` does **not** contain this work: the proxy server and `docs/` are untracked, while the app/config/package changes are unstaged. The installed dependency tree is Expo 53.0.27, React 19.0.0, and React Native 0.79.6.

Do not commit or echo secrets. The untracked `.env.example` currently contains a non-placeholder `TMDB_API_TOKEN`; treat it as compromised, rotate/revoke it outside the repository, and replace it with a placeholder before any commit. `.env.template` is a tracked deletion, yet README instructs users to copy it.

## Ordered implementation tasks

1. **Repair the environment-file contract before staging anything.**

   - Restore one tracked, sanitized template (prefer `.env.template` to match README) with only `TMDB_API_TOKEN=your_tmdb_bearer_token` and `EXPO_PUBLIC_MOVIES_API_URL=http://localhost:3001/api`.
   - Remove the token-bearing untracked `.env.example`, or replace it with the same placeholders and consistently document that filename. Keep `.env` ignored. Confirm no token is in tracked files or Git history being committed.

2. **Land and normalize the proxy contract.**

   - Add `server/movies-api.mjs` to source control. Keep the token server-only and forward only GET requests to TMDB.
   - Make the documented public routes canonical: `/health`, `/api/movies/now-playing`, `/api/movies/popular`, `/api/movies/upcoming`, `/api/movies/:id`, `/api/search/movies`, and `/api/genres`.
   - The current detail matcher accepts `/api/movie/:id` (and odd `/api/movies/movie/:id`) but rejects the documented `/api/movies/:id`; this was reproduced as 404. Fix it. Remove old TMDB-shaped aliases after every client caller is migrated, or explicitly retain/test them as temporary compatibility aliases.
   - Preserve query forwarding for `page`, `query`, `language`, `include_adult`, and `append_to_response`. Return upstream status/body and a controlled 502 for network/invalid-JSON failures. Decide whether LAN exposure plus `Access-Control-Allow-Origin: *` is development-only; document/bind/restrict it appropriately because it otherwise exposes a token-backed proxy to the local network.

3. **Move all client calls to the public proxy vocabulary.**

   - Centralize route constants/helper functions in `src/api/tmdb/` rather than embedding TMDB paths in views.
   - Update callers in `src/pages/Home/index.tsx`, `SearchMovie/index.tsx`, `SearchFilters/index.tsx`, `MovieDetail/index.tsx`, and `src/components/HorizontalMovieCard/index.tsx`.
   - In particular replace `movie/now_playing`, `search/movie`, `genre/movie/list`, and `movie/:id` with canonical paths. Pass detail options through Axios `params` rather than embedding a query string in the URL.
   - Keep the client free of Firebase/TMDB credentials; `src/api/firebase.js` remains deleted and `firebase` remains absent from dependencies. Harden `getQueued` against network errors with no `error.response`, otherwise a proxy outage is masked by a TypeError.

4. **Repair persistence before web/native QA.**

   - In `src/api/database/index.ts`, await every schema statement inside the transaction (`Promise.all` or a loop); `sql.map(async ...)` currently leaves work unawaited.
   - Use one schema name/type consistently: existing creation uses `filter INT`, while all writes/reads/updates use `mode`. Use a text mode column, correct `DELETE FROM genre_filter WHERE genre = ?`, and delete by `genre.id`, not the row `id`.
   - Provide a migration for existing on-device `genre_filter` tables. `CREATE TABLE IF NOT EXISTS` cannot repair them; add/backfill the intended column or recreate safely while preserving usable selected genres. Test selected genre toggling and mode changes after an upgrade as well as on a clean database.

5. **Resolve SDK/config tooling drift.**

   - Remove the duplicate `expo-localization` plugin from `app.json`.
   - Keep `package.json` CommonJS-neutral because `babel.config.js` and `metro.config.js` use CommonJS. Rename `eslint.config.js` to `eslint.config.mjs` (or convert it to CommonJS) rather than adding `"type": "module"`, which would break those config files. This eliminates the current Node `MODULE_TYPELESS_PACKAGE_JSON` lint warning.
   - Declare a supported Node version (recommend Node 22 LTS, or at least the version required by `node --env-file` and built-in `fetch`) via `engines` and/or `.nvmrc`; CI already uses Node 22.
   - Fix the `SearchMovie` exhaustive-deps warning correctly. The current effect reads `moviesPage.page` and `moviesPage.total_pages` from a ref-derived value but omits them from dependencies; avoid adding unstable values blindly and preserve pagination semantics.

6. **Synchronize generated native projects with SDK 53.**

   - First inspect and preserve intentional native customizations. Then use the project’s Expo prebuild/native-sync workflow (normally `npx expo prebuild --clean`, followed by CocoaPods installation as needed) and review the generated diff.
   - The committed `ios/Podfile.lock` still pins ExpoLocalization 16.0.1, ExpoSecureStore 14.0.1, ExpoSQLite 15.1.2, React-Core 0.76.7, and Hermes 0.76.7, so it does not match the JS SDK 53/RN 0.79.6 stack. Refresh it and verify Android generated artifacts too.
   - Expo Doctor currently warns that native folders plus app-config native fields require prebuild syncing; do not dismiss this warning. It also reports CocoaPods tooling unavailable/outdated (recommended >= 1.15.2), which blocks local iOS validation until resolved.

7. **Update documentation and CI after behavior is final.**

   - Make README setup, file name, Node version, API process, physical-device LAN URL, and exact route matrix agree with the implementation. State that `EXPO_PUBLIC_MOVIES_API_URL` is public build-time configuration and the TMDB token is never public.
   - Add CI steps after `npm ci`: `npx tsc --noEmit`, `node --check server/movies-api.mjs`, and a server health smoke test using a dummy token. Add a lightweight Expo/web/config validation if it is stable in CI. Format every new document; the current repository-wide Prettier check fails because `docs/SubAgent docs/migration-assessment.md` is not formatted.

8. **Stage intentionally and review the final migration.**
   - Include the proxy, sanitized env template, dependency lockfile, generated native changes, source/config/docs/CI changes; do not include `.env` or secret-bearing files.
   - Review `git diff --check`, `git status --short`, and staged diff for credential leakage before committing.

## Required validation sequence

Run from a clean install after completing the tasks:

```sh
npm ci
npx expo install --check
npm run lint
npx tsc --noEmit
npx prettier --check .
node --check server/movies-api.mjs
npx expo-doctor
```

Start the proxy using a real token only in a local ignored `.env` and test its complete public contract:

```sh
npm run api
curl --fail http://127.0.0.1:3001/health
curl --fail 'http://127.0.0.1:3001/api/movies/now-playing?page=1'
curl --fail 'http://127.0.0.1:3001/api/movies/popular?page=1'
curl --fail 'http://127.0.0.1:3001/api/movies/upcoming?page=1'
curl --fail 'http://127.0.0.1:3001/api/movies/550?append_to_response=videos'
curl --fail 'http://127.0.0.1:3001/api/search/movies?query=alien&page=1'
curl --fail 'http://127.0.0.1:3001/api/genres'
```

Then run `npm run web`, point it at the live proxy, and manually smoke home pagination, search pagination, movie detail/trailer, bookmark persistence, filter selection/mode persistence, settings, and CORS/network-error behavior. Run `npm run android` and `npm run ios` after native regeneration; iOS requires working CocoaPods. Validate the same discovery/detail/filter paths on at least one native target.

## Validation results before implementation

- `npx tsc --noEmit`: passed.
- `npm run lint`: exited 0 with the ESM module-format warning and one `SearchMovie` hook-dependency warning.
- Proxy smoke with a dummy token: `/health` returned 200; documented `/api/movies/123` returned 404; legacy `/api/movie/123` reached TMDB and returned 401, confirming the route mismatch.
- `npx prettier --check .`: failed only on the existing assessment document, so the server syntax check chained after it did not run in that command; rerun it independently during implementation.
- `npx expo-doctor`: 16/18 checks passed; the two failures are CocoaPods tooling and unsynced native/app config described above.
