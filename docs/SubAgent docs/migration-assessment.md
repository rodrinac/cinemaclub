# Migration Assessment: Cinema Club

Date: 2026-09-01
Repository: `/Users/ctw04356/Dev/rodrinac/cinemaclub`
Branch assessed: `chore/expo-sdk-53-api-web`

## Executive summary

This repository is clearly mid-migration from a **client-only Expo app that fetched TMDB credentials through Firebase** to a **web-capable Expo SDK 53 app that talks to a local Node proxy API**.

The intended migration is only **partially landed**:

- the dependency/config changes are present in the working tree,
- the new API server exists only as an **untracked** `server/` folder,
- the client has been rewired to the local API,
- TypeScript/lint fixes were added for newer Expo / React Navigation / React 19 types,
- but the migration is **not yet production-ready** because the route contract is inconsistent, native artifacts are not fully synchronized, and there are existing SQLite/filter bugs that will still break migrated flows.

## High-confidence inferred migration goals

Based on the current diff, configs, and source changes, the migration appears to be:

1. **Upgrade Expo / React Native stack**

   - Expo `52` -> `53`
   - React `18` -> `19`
   - React Native `0.76.7` -> `0.79.6`
   - related Expo modules upgraded in `package.json`

2. **Add web support**

   - `app.json` adds `"web"` to `platforms`
   - `package.json` includes `react-dom`, `react-native-web`, `@expo/metro-runtime`
   - README now documents web usage

3. **Remove Firebase from the app’s TMDB credential path**

   - delete `src/api/firebase.js`
   - remove `firebase` from dependencies
   - replace client TMDB auth bootstrap with a local server proxy using `TMDB_API_TOKEN`

4. **Move TMDB token handling server-side**

   - new `.env.template` switches from `EXPO_PUBLIC_FIREBASE_*` variables to:
     - `TMDB_API_TOKEN`
     - `EXPO_PUBLIC_MOVIES_API_URL`
   - new `server/movies-api.mjs` proxies TMDB requests

5. **Tighten compatibility with newer type/runtime expectations**
   - `tsconfig.json` switches `moduleResolution` to `bundler`
   - `src/routes.tsx` adds `StaticParamList` typing for React Navigation 7
   - `App.tsx`, `FooterBar`, `SearchFilters` contain TS compatibility fixes

## Repository state at assessment time

### Git status

`git status --short --branch` showed:

- modified:
  - `.env.template`
  - `.gitignore`
  - `App.tsx`
  - `README.md`
  - `app.json`
  - `package-lock.json`
  - `package.json`
  - `src/api/tmdb/index.ts`
  - `src/components/FooterBar/index.tsx`
  - `src/pages/SearchFilters/index.tsx`
  - `src/routes.tsx`
  - `tsconfig.json`
- deleted:
  - `src/api/firebase.js`
- untracked:
  - `server/`

### Important implication

The migration is **not committed yet**. `HEAD`, `master`, and `origin/master` all point at commit `fba2883` (`chore: migrate package management to npm`), so the Expo/API/web migration currently exists as **local working-tree changes only**.

### Recent commit history relevant to migration

- `fba2883` — migrate package management to npm
- `1a8b3c3` — hide credentials
- earlier 2025 commits added new Expo architecture, filters, settings, and movie pages

This means:

- npm migration is already committed,
- credentials hiding was started earlier through `.env.template`,
- the current uncommitted work is the next step: **finish the actual Firebase removal + local API + SDK 53 + web migration**.

## Relevant repository structure

Top-level structure observed:

- `App.tsx`
- `README.md`
- `app.json`
- `package.json`
- `tsconfig.json`
- `babel.config.js`
- `metro.config.js`
- `android/`
- `ios/`
- `server/` _(untracked)_
- `src/`
  - `api/`
  - `components/`
  - `pages/`
  - `routes.tsx`

No app test files were found outside dependencies:

- no `*.test.*`
- no `*.spec.*`
- no `__tests__/`

## Evidence by file

### 1) `package.json`

Evidence:

- `package.json:4-9` adds `api` script: `node --env-file=.env server/movies-api.mjs`
- `package.json:15-40` upgrades Expo/React Native stack and adds web runtime dependencies
- `package.json:19-40` now targets Expo 53 + React 19 + RN 0.79.6
- `firebase` is removed from dependencies

Interpretation:

- this is the main SDK migration manifest,
- the app now expects a local API process,
- web support is being formalized.

### 2) `app.json`

Evidence:

- `app.json:6` adds `"web"` to `platforms`
- `app.json:14` keeps `newArchEnabled: true`
- `app.json:23-40` enables Expo plugins, but `expo-localization` appears **twice**

Interpretation:

- web is explicitly in scope,
- new architecture remains enabled during the upgrade,
- plugin duplication should be cleaned up to reduce config noise and ambiguity.

### 3) `.env.template`

Evidence:

- replaced all `EXPO_PUBLIC_FIREBASE_*` variables with:
  - `TMDB_API_TOKEN`
  - `EXPO_PUBLIC_MOVIES_API_URL`

Interpretation:

- the secret is intentionally moved off the client,
- the app now depends on a proxy URL rather than direct TMDB access.

### 4) `src/api/tmdb/index.ts`

Evidence:

- `src/api/tmdb/index.ts:8-18` changes `baseURL` from TMDB to `process.env.EXPO_PUBLIC_MOVIES_API_URL || "http://localhost:3001/api"`
- Firebase imports were removed
- the old async `setTmdbApiKey()` bootstrap was removed

Interpretation:

- the app is now wired to a local API contract,
- Firebase is no longer part of the runtime path for movie fetching.

### 5) `server/movies-api.mjs`

Evidence:

- `server/movies-api.mjs:3-5` reads `TMDB_API_TOKEN`
- `server/movies-api.mjs:35-45` defines proxy routes
- `server/movies-api.mjs:61-67` supports `/health` and movie detail route matching

Interpretation:

- this is the replacement for client-side credential loading,
- it is currently the critical piece of the migration,
- but it is still **untracked** and its route contract is inconsistent.

### 6) `src/api/firebase.js`

Evidence:

- file is deleted in the working tree
- `git show HEAD:src/api/firebase.js` confirms the committed code still initializes Firebase/Firestore and reads `EXPO_PUBLIC_FIREBASE_*`

Interpretation:

- Firebase removal is intended,
- but because the migration is not committed, the repo’s committed state still depends on Firebase.

### 7) `src/routes.tsx`, `App.tsx`, `FooterBar`, `SearchFilters`

Evidence:

- `src/routes.tsx:23-29` adds `StaticParamList` + `ReactNavigation.RootParamList`
- `App.tsx:67-69` narrows icon names for `Ionicons`
- `src/components/FooterBar/index.tsx` makes `elevated` optional
- `src/pages/SearchFilters/index.tsx` casts segmented button value to `GenreFilterMode`

Interpretation:

- these are migration-adjacent compatibility fixes for updated typings/APIs,
- they look correct and are likely necessary for Expo 53 / React 19 / React Navigation 7.

## Current validation state

### Commands run

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npx prettier --check .`
4. `node --check server/movies-api.mjs`
5. started `server/movies-api.mjs` with a dummy token on port `3101`
6. `curl http://127.0.0.1:3101/health`
7. `curl http://127.0.0.1:3101/api/movies/123`
8. `curl http://127.0.0.1:3101/api/movie/123`

### Results

#### TypeScript

- `npx tsc --noEmit` **passed**

Meaning:

- the working-tree migration currently type-checks.

#### ESLint

- `npm run lint` **passed with 1 warning**
- warning:
  - `src/pages/SearchMovie/index.tsx:96`
  - missing deps: `moviesPage.page` and `moviesPage.total_pages`

Additional runtime/tooling warning during lint:

- Node emitted `[MODULE_TYPELESS_PACKAGE_JSON]`
- cause: `eslint.config.js` uses ESM syntax, but `package.json` does not declare `"type": "module"`

Meaning:

- app code lint is close,
- but the module-format setup is inconsistent and should be cleaned up.

#### Prettier

- `npx prettier --check .` **passed**

#### API server syntax

- `node --check server/movies-api.mjs` **passed**

#### API smoke

- `GET /health` returned `{"status":"ok"}`
- `GET /api/movie/123` returned **401 Invalid API key** with dummy token
  - this proves the route exists and proxies to TMDB
- `GET /api/movies/123` returned **404 Route not found**

Meaning:

- the server starts successfully,
- the client-style movie detail route works,
- the README-documented movie detail route does **not** work.

## Key remaining work

## 1. Normalize and finish the API contract

### Why this is blocking

The app has been rewired to use the proxy, so this contract must be stable before the migration can be considered done.

### Evidence

- README documents:
  - `/api/movies/now-playing`
  - `/api/movies/popular`
  - `/api/movies/upcoming`
  - `/api/movies/:id`
  - `/api/search/movies`
  - `/api/genres`
- app code calls:
  - `movie/now_playing`
  - `movie/popular`
  - `movie/upcoming`
  - `movie/:id`
  - `search/movie`
  - `genre/movie/list`
- server supports both styles for several list/search routes, but movie detail matching is:
  - `^/api/(?:movies/)?movie/(\\d+)$`

### Concrete problems

1. **README and implementation disagree**

   - documented detail route: `/api/movies/:id`
   - implemented working detail route: `/api/movie/:id`

2. **Route styles are mixed**

   - plural + hyphen (`movies/now-playing`)
   - singular + underscore (`movie/now_playing`)
   - raw TMDB-like path fragments in the client (`genre/movie/list`, `search/movie`)

3. **The app leaks server-internal naming into the UI layer**
   - `src/pages/Home/index.tsx` hardcodes TMDB-style route strings
   - `src/pages/SearchFilters/index.tsx` and `SearchMovie/index.tsx` do the same

### Recommended changes

- choose one public API shape and stick to it,
- prefer app-facing, normalized routes such as:
  - `/api/movies/now-playing`
  - `/api/movies/popular`
  - `/api/movies/upcoming`
  - `/api/movies/:id`
  - `/api/search/movies`
  - `/api/genres`
- make the client call only that public shape,
- keep compatibility aliases temporarily only if needed,
- update README to document the exact supported contract,
- add at least a route smoke test or documented curl matrix.

## 2. Commit and integrate the new API server properly

### Why this matters

`server/` is currently untracked, so the migration cannot be reproduced from Git alone.

### Evidence

- `git status` shows `?? server/`
- `package.json` already references `server/movies-api.mjs`

### Recommended changes

- add `server/movies-api.mjs` to version control,
- ensure all contributors can run it from a fresh clone,
- document Node version expectations (see next section).

## 3. Resolve Node/module-system ambiguity

### Evidence

- `package.json` has no `"type": "module"`
- `eslint.config.js` uses ESM `import` / `export default`
- `babel.config.js` and `metro.config.js` use CommonJS `module.exports` / `require`
- lint currently emits `[MODULE_TYPELESS_PACKAGE_JSON]`
- the API script uses `.mjs`, which is explicitly ESM
- `package.json` script uses `node --env-file=.env`, which requires a modern Node runtime

### Risks

- confusing local behavior across Node versions,
- noisy CI / local warnings,
- accidental breakage if `"type": "module"` is reintroduced without renaming CJS config files.

### Recommended changes

Pick one of these approaches and apply it consistently:

1. **Keep package.json without `"type": "module"`**

   - rename `eslint.config.js` -> `eslint.config.mjs`, or
   - rewrite ESLint config to CommonJS

2. **Restore `"type": "module"`**
   - then rename `babel.config.js` and `metro.config.js` to `.cjs` or convert them safely

Also:

- add `"engines"` in `package.json` or a `.nvmrc`
- explicitly document the minimum Node version required for:
  - `fetch` in Node
  - `--env-file`

## 4. Synchronize native artifacts with SDK 53

### Evidence

`package.json` now wants:

- `expo-localization ~16.1.6`
- `expo-secure-store ~14.2.4`
- `expo-sqlite ~15.2.14`
- React Native `0.79.6`

But `ios/Podfile.lock` still shows:

- `ExpoLocalization (16.0.1)`
- `ExpoSecureStore (14.0.1)`
- `ExpoSQLite (15.1.2)`
- `React-Core (0.76.7)`
- `hermes-engine (0.76.7)`

### Interpretation

The JS dependency upgrade has happened, but the iOS native lockfile still reflects the **older stack**.

### Risks

- iOS build breakage,
- pod resolution drift,
- subtle runtime mismatch between JS packages and native pods.

### Recommended changes

- refresh iOS native dependencies (`pod install` / normal Expo-native sync flow),
- verify Android and iOS builds against the upgraded SDK,
- do not consider the SDK migration complete until native builds actually run.

## 5. Validate web support end-to-end

### Evidence

- `app.json` includes `"web"`
- `package.json` adds `react-dom`, `react-native-web`, `@expo/metro-runtime`
- README now explicitly advertises web support

### Gaps

- no web build script exists,
- no web smoke test exists,
- no CI check validates the proxy + Expo web flow together.

### Recommended changes

- run and verify `npm run web`,
- confirm movie discovery, search, details, settings, and filters on web,
- verify `EXPO_PUBLIC_MOVIES_API_URL` behavior for:
  - local browser on same machine,
  - physical device on LAN,
  - any future deployed environment.

## 6. Fix pre-existing SQLite/filter bugs before calling the migration done

These are not introduced by the current migration diff, but they are tightly coupled to the migrated app’s real usability and should be fixed during the same implementation phase.

### Evidence in `src/api/database/index.ts`

1. **Transaction init is not awaited correctly**

   - `initDB()` uses `sql.map(async ...)` inside `withTransactionAsync`
   - those promises are not awaited

2. **Schema/query mismatch**

   - table defines column `filter`
   - code inserts/updates/reads column `mode`

3. **Malformed SQL**

   - `DELETE genre_filter WHERE id = ?` is missing `FROM`

4. **Potential wrong delete predicate**
   - delete uses `id = ?` with `genre.id`, but the lookup key elsewhere is `genre`

### Likely user-facing impact

- filter toggling may fail,
- filter mode may never persist correctly,
- initialization may race on fresh installs,
- migrated web/native QA could appear broken even if the proxy migration itself is correct.

### Recommended changes

- fix schema/query consistency first,
- add a tiny persistence smoke test matrix for bookmarks + genre filters,
- verify these flows on at least one platform during migration validation.

## 7. Expand validation/CI coverage

### Evidence

`.github/workflows/pull_requests.yml` currently runs only:

- `npm ci`
- `npm run lint`
- `npx prettier --check .`

### Gaps

- no typecheck in CI
- no API smoke check
- no web smoke/build check
- no native smoke/build validation
- no route contract validation

### Recommended changes

At minimum add:

- `npx tsc --noEmit`
- server syntax/smoke
  - `node --check server/movies-api.mjs`
  - boot server + curl `/health`
- if feasible, a minimal web check or Expo config validation

## Lower-priority cleanup items

1. remove duplicated `expo-localization` entry in `app.json`
2. review whether `install` dependency is still needed
3. review whether direct `react-native-vector-icons` dependency is needed since source imports `@expo/vector-icons`
4. consider centralizing API route strings in one file rather than hardcoding TMDB-like fragments in UI pages

## Recommended ordered implementation plan

### Phase 1 — land the proxy migration cleanly

1. Add `server/movies-api.mjs` to Git
2. choose and document one public route contract
3. update server route matching to support that contract completely
4. update client API calls to use the public contract only
5. update README examples so they exactly match implementation

### Phase 2 — stabilize local dev/runtime contracts

6. resolve ESM/CJS config strategy
7. define minimum Node version (`engines` or `.nvmrc`)
8. confirm `.env.template` + README fully describe required setup

### Phase 3 — fix migrated app blockers

9. repair SQLite/filter persistence bugs in `src/api/database/index.ts`
10. address the `SearchMovie` hook dependency warning
11. clean minor config duplication (`expo-localization` repeated plugin)

### Phase 4 — sync native projects

12. refresh iOS pods / native lockfiles to match SDK 53 package versions
13. verify Android native build with current config
14. verify iOS native build with current config

### Phase 5 — validate end-to-end

15. run proxy locally with a real `TMDB_API_TOKEN`
16. smoke test:
    - home/discover
    - search
    - movie details
    - settings
    - filters
17. smoke test web flow using the proxy
18. smoke test at least one native platform

### Phase 6 — protect the migration in CI

19. add typecheck to PR workflow
20. add API syntax/health validation
21. optionally add a lightweight web smoke/build check

## Concrete file-change recommendations

### Must-change files

- `server/movies-api.mjs`
  - normalize route contract
  - ensure documented detail route works
- `src/api/tmdb/index.ts`
  - point only at normalized public API paths
- `src/pages/Home/index.tsx`
  - stop using TMDB-style route fragments directly
- `src/pages/SearchMovie/index.tsx`
  - same as above
  - fix hook dependency warning
- `src/pages/SearchFilters/index.tsx`
  - same as above where applicable
- `README.md`
  - route contract
  - Node version
  - API start instructions
- `src/api/database/index.ts`
  - fix SQL/runtime bugs

### Probably-change files

- `package.json`
  - engines and/or module-format decision
- `app.json`
  - plugin cleanup
- `.github/workflows/pull_requests.yml`
  - add typecheck/API smoke
- `ios/Podfile.lock`
  - refresh after pod sync

## Suggested validation commands for implementation phase

Use these after the implementation work is done:

```sh
npm install
npm run lint
npx prettier --check .
npx tsc --noEmit
node --check server/movies-api.mjs
TMDB_API_TOKEN=your_real_token_here npm run api
curl http://localhost:3001/health
npm run web
npm run ios
npm run android
```

Recommended route smoke checks after the route contract is normalized:

```sh
curl "http://localhost:3001/api/movies/now-playing"
curl "http://localhost:3001/api/movies/popular"
curl "http://localhost:3001/api/movies/upcoming"
curl "http://localhost:3001/api/movies/550"
curl "http://localhost:3001/api/search/movies?query=alien"
curl "http://localhost:3001/api/genres"
```

## Bottom line

The migration direction is good and the core intent is clear:

- **Expo SDK 53**
- **web support**
- **server-side TMDB secret handling**
- **Firebase removal from the client**

But the repository is still in a **transition state**, not a completed migration. The most important unfinished items are:

1. commit + finish the proxy API,
2. normalize the route contract,
3. sync native artifacts,
4. fix the SQLite/filter bugs that will otherwise make migrated QA fail,
5. add stronger validation so the migration is reproducible and safe.
