# Expo SDK 54, CNG/EAS, and Prisma Planning Specification

**Repository:** `rodrinac/cinemaclub`  
**Prepared:** 2026-09-01  
**Baseline branch:** `master` at `20a5c0c` (`origin/master` matched after `git fetch --prune`)  
**Scope:** implementation plan only; this document intentionally makes no application/configuration changes.

## 1. Executive decision

Implement the work in separately reviewable PRs, in this order:

1. **Upgrade the Expo platform from SDK 53 to SDK 54** with Expo-managed compatible dependency versions, retain the New Architecture, and address SDK 54 breaking changes.
2. **Adopt Continuous Native Generation (CNG)** only after every intentional native customization is represented in app config or a config plugin. Stop treating the tracked `ios/` and `android/` output as the source of truth. Configure EAS profiles and use development builds for native work.
3. **Keep the existing local `expo-sqlite` persistence as the production default**. Do **not** replace it with Prisma in the same release as the SDK/CNG upgrade.
4. Run a **native-only Prisma local-SQLite spike** as an opt-in follow-up. Prisma React Native is officially Early Access and the repository has a web target; web support/parity for this Prisma path must be proved rather than assumed.
5. If user accounts, cross-device sync, or shared lists are a product goal, introduce a **server API plus hosted PostgreSQL** in a separate architecture PR. Run Prisma server-side. Never expose a database/Accelerate connection string to the Expo client.

This avoids combining a native-platform replacement, a build-system change, and a database rewrite—three changes with independent rollback paths.

## 2. Current state (verified)

### Source, runtime, and package management

- npm is the package manager: `package-lock.json` version 3 is committed; there is no yarn/pnpm/bun lockfile.
- `package.json` requires Node `>=22.0.0`; local inspection used Node `v24.20.0`, npm `11.19.0`; PR CI uses Node 22.
- The current resolved stack is:

  | Concern           | Manifest / resolved version |
  | ----------------- | --------------------------- |
  | Expo              | `expo ^53.0.27` / `53.0.27` |
  | React + React DOM | pinned `19.0.0`             |
  | React Native      | pinned `0.79.6`             |
  | Expo SQLite       | `~15.2.14` / `15.2.14`      |
  | Metro runtime     | `~5.0.5` / `5.0.5`          |
  | Reanimated        | `~3.17.4`                   |
  | TypeScript        | `~5.8.3`                    |
  | Prisma packages   | absent                      |

- It is an Expo app using the legacy `App.tsx` entry and React Navigation 7, not Expo Router. It supports iOS, Android, and web.
- `babel.config.js` and `metro.config.js` use CommonJS; `eslint.config.mjs` uses ESM. Do not set package-level `"type": "module"` while retaining the two CommonJS config filenames.
- Existing npm scripts are `start`, `android`, `ios`, `web`, `api`, and `lint`; no `test`, typecheck, format-check, EAS, or prebuild script exists.

### App configuration and platform files

- `app.json` has package/bundle ID `com.anonymous.cinemaclub`, portrait orientation, app/splash assets, `newArchEnabled: true`, `ios.supportsTablet: false`, Android Play Store URL, and plugins for `expo-secure-store`, `expo-sqlite`, `expo-localization`, and `expo-splash-screen`.
- The app uses Hermes and the New Architecture in both app config and generated native settings.
- `ios/` and `android/` are **tracked**, so EAS Build will compile those folders as-is and will _not_ automatically run Prebuild. They look primarily generated but cannot safely be deleted yet.
- Native details that need deliberate review before CNG conversion:
  - iOS: deployment target fallback is 15.1; `Info.plist` has local-networking allowed, Face ID usage text, portrait orientations, no tablet support, and the app URL scheme. `AppDelegate.swift` is the Expo-generated integration point. There is no custom entitlement payload.
  - Android: custom package/namespace and orientation are present. The manifest has legacy external-storage read/write permissions, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, HTTPS browse queries, secure-store backup rules, and disabled Expo Updates metadata. No source usage was found that demonstrates a need for external-storage permissions; preserve or remove them only after product review.
  - Android retains a JitPack repository, GIF/WebP flags, custom Gradle memory settings, and `expo.edgeToEdgeEnabled=false` (SDK 54 will make edge-to-edge mandatory on Android 16/API 36).
  - No custom native module was found in `MainApplication.kt`, `MainActivity.kt`, or `AppDelegate.swift`; the comments describe Expo extension points only.
- CocoaPods is unavailable on this machine (`pod: command not found`), so local iOS pod/build validation is currently blocked.

### Data and API architecture

- The mobile app calls the Node `server/movies-api.mjs` TMDB proxy using the public `EXPO_PUBLIC_MOVIES_API_URL`; the TMDB bearer token remains server-side (`TMDB_API_TOKEN`). The server is a read-only HTTP proxy, not an application database/API for user data.
- `src/api/database/index.ts` is the sole persistence abstraction and directly uses `expo-sqlite` (`SQLite.openDatabaseAsync("CINEMA_CLUB")`). It stores only device-local data:
  - `movie_bookmark`: `id`, unique `movie` ID.
  - `genre_filter`: `id`, unique genre string, text `mode`.
- `initDB()` creates those tables and contains a narrow legacy migration: when an old `genre_filter.filter` column exists without `mode`, it adds `mode` with a default. The async transaction is awaited. This is not a general migration ledger/versioning system.
- Consumers are `App.tsx` (initialization), movie-detail and card components (bookmarks), and filter/search pages (genre filters). No schema, migrations directory, Prisma Client, database URL, hosted database, authentication, or synchronization code exists.
- The local database is per installation/device. It neither authenticates a user nor syncs data to web/another device.

### Tests, validation, CI, and documentation

- No first-party test files (`*.test.*`, `*.spec.*`, `__tests__`) or configured Jest/Vitest/Detox/Maestro runner exist. Jest-related packages are transitive dependency artifacts only.
- `.github/workflows/pull_requests.yml` runs `npm ci`, ESLint, Prettier, `npx tsc --noEmit`, Node syntax validation for the TMDB server, and a `/health` curl smoke test. It is a Node-only Linux job; it does not build web/iOS/Android.
- Dependabot checks npm dependencies daily within manifest ranges.
- `README.md` covers local API startup, web start, and physical-device LAN configuration but does not document CNG/EAS/database architecture.

## 3. Target state and four-goal feasibility

### Goal A — Expo SDK 54 upgrade: **feasible; recommended**

Expo SDK 54 ships **React Native 0.81 and React 19.1**. The official SDK 54 release notes prescribe:

```sh
npx expo install expo@^54.0.0 --fix
npx expo-doctor@latest
```

The app is already on React 19 and has the New Architecture enabled, which reduces migration distance. It does use Reanimated 3 and manually maintained native output, which make validation essential.

**Required effects:** SDK 54 targets Android API 36 and enables edge-to-edge universally. Validate every screen’s safe-area, status-bar, keyboard, footer, and navigation-bar layout; the existing `expo.edgeToEdgeEnabled=false` cannot remain an effective opt-out. Upgrade package versions through `expo install`, not hand-selected versions from a blog post. SDK 54 also moves its recommended TypeScript baseline to `~5.9.2`, updates vector icon families, changes Metro behavior, and surfaces unhandled promise rejections as errors.

### Goal B — React 19 compatibility: **already substantially achieved; validate at 19.1**

The repository currently has React/React DOM 19.0.0 and RN 0.79.6 under SDK 53. SDK 54’s supported pairing is React 19.1 with RN 0.81. Do not attempt to independently upgrade React or RN before Expo chooses the compatible versions. Use `npx expo install --fix`, then commit the resulting manifest and lockfile together.

The code’s React 19 concerns are ordinary migration checks: React Navigation types, `react-native-paper`, fonts, Reanimated, vector icon types, and stale-effect/promise errors. Existing `App.tsx` and navigation types already compile at the SDK 53 baseline; that is encouraging but not sufficient evidence for 54.

### Goal C — CNG/Prebuild and EAS Build: **feasible; recommended after native-customization capture**

Expo’s current CNG guidance is clear: make `app.json`/config plugins and package versions the source of truth, then generate short-lived `ios/` and `android/` folders using `npx expo prebuild`. With native folders absent/ignored, EAS runs Prebuild before compilation; with them committed, EAS does not run Prebuild to avoid overwriting modifications.

This project can adopt CNG because no custom native Java/Kotlin/Swift/Obj-C module was found. However, it currently has native-only settings and permissions that must first be classified and represented by app config/config plugins. A blind `prebuild --clean` risks silently losing them. `@prisma/react-native` has an Expo config plugin, so adopting CNG also reduces its installation risk.

EAS is suitable for repeatable Android/iOS development, preview, and production binaries, credentials, and internal distribution. Its initial setup (`eas build:configure`) creates `eas.json` and requires an Expo account. It is **not** a replacement for unit tests or a reason to spend cloud-build quota on every pull request.

### Goal D — Prisma: two distinct architecture choices

#### D1. Prisma for local device SQLite: **technically feasible, but Early Access and native-only spike first**

Prisma’s official `@prisma/react-native` package describes an Early Access React Native engine and supports Expo through its config plugin. Its documented setup installs exact current `@prisma/client`, `@prisma/react-native`, and `react-native-quick-base64`; enables `previewFeatures = ["reactNative"]`; adds `"@prisma/react-native"` to `app.json`; generates a SQLite schema/migrations; and runs `npx expo prebuild --clean` so migrations are copied into iOS/Android application bundles. At app startup it applies pending migrations.

Benefits for this tiny local schema are generated types, a formal migration history, and optional reactive queries. Costs are an Early Access native engine, generated-client lifecycle, on-device migration failure handling, native development build requirements, and a larger release/migration surface. Prisma warns that failed user-device migrations can leave the app inconsistent and require app-data deletion/reinstall.

**Web is a decision gate.** Prisma’s React Native readme only promises React Native/Expo and documents native Xcode/Gradle integration; it does not establish browser support for its local SQLite client. `expo-sqlite` itself advertises web support as alpha and requires WASM Metro and COOP/COEP response headers. Therefore, do not claim that Prisma local SQLite works in this app’s web bundle until a CI/build/browser spike verifies it. A platform-specific persistence adapter (or retaining direct `expo-sqlite` for native plus browser storage for web) is required if it does not.

**Recommendation:** retain `expo-sqlite` now. Approve a small, reversible Prisma spike only if the type-safe ORM/migration ergonomics outweigh Early Access and if product accepts native-only local persistence or a maintained web adapter.

#### D2. Prisma for a hosted database: **feasible and the preferred design for shared data**

For accounts, synchronized favorites/lists, collaboration, and recovery across devices, use this topology:

```text
Expo native/web client -- HTTPS + user auth --> application API -- Prisma ORM --> PostgreSQL
```

The current Node TMDB proxy could evolve into that API only after adding authentication, authorization, input validation, rate limiting, deployment, secrets management, and a persistent database. More cleanly, create a separately deployed backend/service with an explicit API contract. Run ordinary `@prisma/client` and migrations only in the trusted server/build environment. Store the Postgres `DATABASE_URL` only there.

**Never** ship a Postgres connection URL, Prisma credentials, Accelerate API key, or privileged database token as `EXPO_PUBLIC_*` configuration or in a mobile/web bundle. A direct mobile/browser-to-Postgres design is insecure and not a substitute for server-side authorization.

Prisma Accelerate is optional server infrastructure: it provides managed pooling and global query caching, most useful for serverless/edge APIs; it supports PostgreSQL and other databases. It is not local SQLite, an offline sync engine, or a client authorization boundary. Add it only after measuring connection pressure/latency and reviewing cache correctness for per-user data.

## 4. Recommended and non-recommended decisions

| Decision                  | Recommendation                                                | Reason                                                                              |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Expo/RN/React versions    | Upgrade as one Expo SDK 54 unit with `expo install --fix`     | Expo owns the compatible RN/React/module matrix.                                    |
| New Architecture          | Keep enabled                                                  | It is already enabled and SDK 55+ will no longer offer Legacy Architecture opt-out. |
| Edge-to-edge              | Treat as mandatory and remediate layouts                      | SDK 54/RN 0.81 on Android 16 enables it universally.                                |
| Native source of truth    | Move to CNG after conversion audit                            | Avoid manual Gradle/Xcode upgrades and enable repeatable EAS prebuilds.             |
| EAS builds                | Development/preview/production profiles, manually or gated CI | Reproducible signed binaries without turning every PR into a cloud release.         |
| Current bookmarks/filters | Preserve direct `expo-sqlite`                                 | Stable, small, already functional, includes Expo Go support; no server requirement. |
| Prisma local DB           | Spike behind a decision gate                                  | Officially Early Access and web compatibility is not established.                   |
| Shared user data          | API + server-side Prisma + Postgres                           | Supports authorization and sync safely.                                             |
| Prisma Accelerate         | Server-only, later and only if needed                         | Pooling/cache is not a device database or auth layer.                               |

Do **not**:

- Jump to a later SDK in this work item merely because it is newer at implementation time. Re-baseline deliberately; the stated target is SDK 54.
- Hand-pin every Expo module, RN, React, and React DOM version from memory.
- Enable React Compiler, experimental autolinking resolution, or a new SQLite/vector feature as incidental upgrade work; evaluate each independently.
- Run `expo prebuild --clean` over tracked native projects before converting any retained customization into app config/config plugins and reviewing the generated diff.
- Manually add the Prisma Xcode script or Gradle `apply from` while using the Prisma Expo plugin/CNG; choose the plugin to avoid duplicate integration.
- Replace local persistence with a network database while calling it “offline/local-first.” A device database and a hosted database solve different requirements; sync requires its own conflict/auth/offline design.
- Put Prisma migration commands or database credentials in the mobile runtime/CI PR workflow.

## 5. Ordered implementation plan and logical PR phases

### PR 1 — Establish baseline and upgrade Expo SDK 54

1. Start from a clean worktree; record `git status --short --branch`, `npx expo config --type public`, `npx expo install --check`, and `npx expo-doctor@latest` results. Do not overwrite user changes.
2. Read the SDK 54 release notes immediately before editing. Execute `npx expo install expo@^54.0.0 --fix` with Node 22+; it must select the current SDK 54-compatible Expo packages, React 19.1, RN 0.81, React DOM/web, TypeScript, and relevant Expo modules.
3. Review `package.json` and `package-lock.json` together. Delete no dependency unless an Expo diagnostic or code audit establishes it as unused. Keep `react`, `react-dom`, and `react-native` in the exact ranges produced by Expo’s compatibility resolver.
4. Run `npx expo install --check`, `npx expo-doctor@latest`, `npx expo-modules-autolinking verify -v`, lint, typecheck, format check, Node server syntax, and server health smoke. Resolve all new errors/warnings deliberately.
5. Address SDK-54-specific source/config impacts only where detected:
   - audit every `StatusBar`, `KeyboardAvoidingView`, `useSafeAreaInsets`, footer, and full-screen page for Android edge-to-edge;
   - validate changed icon names/types from `@expo/vector-icons`;
   - use error handling for all intentionally fire-and-forget async effects/actions now that unhandled rejections are logged as errors;
   - upgrade Reanimated using Expo’s selected version and migration instructions; SDK 54’s Reanimated v4 requires the New Architecture and `babel-preset-expo` handles the Babel setup;
   - keep the existing Metro extension customization but do not use Metro private imports.
6. Test Android/iOS/web behavior before merging. This PR must not contain CNG conversion, EAS setup, Prisma, or product-schema changes.

**Expected files:** `package.json`, `package-lock.json`, possibly `app.json`, `babel.config.js`, `metro.config.js`, TypeScript/source files directly required by diagnostics, and targeted tests/docs. Native folders remain untouched in this PR unless choosing the non-CNG path temporarily forces native upgrade-helper changes.

### PR 2 — Convert deliberately to CNG and configure EAS

1. Produce a native-customization inventory from current `ios/` and `android/`; for each entry, label it generated/default, required product behavior, required build setting, obsolete, or unverified. Obtain product confirmation for storage permissions and disabled updates.
2. Move required app identity, orientation, icons/splash, URL scheme, supported tablet/orientation behavior, network/permission declarations, and build properties into `app.json` or `app.config.ts`. Use an existing Expo config plugin where available; implement a small local plugin only when the Expo config has no equivalent. Do not preserve raw native mutation by habit.
3. Add `expo-build-properties` only if a specific retained native setting requires it. For iOS, avoid `use_frameworks!` unless required: it prevents SDK 54’s precompiled RN XCFramework benefit. Preserve the minimum iOS target only if it is a documented product constraint.
4. On a clean branch/worktree, generate temporary native output with `npx expo prebuild --clean --no-install`; compare it to the inventory. Fix configuration/plugins until the diff preserves required behavior. Confirm no storage permission, API URL, token, signing key, or secret leaks into generated output.
5. Adopt the CNG convention: remove generated `ios/` and `android/` output from Git and add `/ios` and `/android` to `.gitignore`/`.easignore`, **only after** parity review succeeds. If repository policy requires generated projects committed, explicitly retain the non-CNG maintenance path instead and apply Expo’s native upgrade helper each SDK; do not claim EAS will prebuild in that mode.
6. Run `npx expo prebuild --clean`, then `npx expo run:android` and `npx expo run:ios` locally where tooling is available. Install/update CocoaPods first on macOS; the current machine cannot validate iOS until `pod` is available.
7. Set up EAS: `npx eas-cli@latest build:configure`. Add `eas.json` profiles at minimum:
   - `development`: development client, internal distribution (Android APK / iOS device development as appropriate);
   - `preview`: internal distribution for QA;
   - `production`: store distribution.
8. Add `expo-dev-client` through `npx expo install expo-dev-client` if using development builds. Build at least one Android and one iOS development/preview binary, install them, and test all native modules. Configure EAS environment variables so only the public API base URL is client-visible; TMDB and database secrets remain backend-only.

**Expected files:** `app.json` or `app.config.ts`, a local `plugins/` file only if truly needed, `package.json`/lockfile if `expo-build-properties` or `expo-dev-client` is needed, `eas.json`, `.gitignore`, `.easignore`, and README. `ios/`/`android/` are removed only when the team approves CNG output as untracked.

### PR 3 — Harden persistence and test seams without Prisma

1. Extract a narrow `Database`/repository type around the existing bookmark/filter operations. Keep the public behavior and existing SQLite file name/table names unless there is a planned data migration.
2. Add a schema-version/migration ledger appropriate to `expo-sqlite`; preserve existing `genre_filter` legacy-column upgrade. Make every migration idempotent, ordered, atomic where SQLite allows, and observable with actionable errors.
3. Add focused unit tests with an Expo-compatible Jest setup/mocked SQLite implementation, plus an on-device integration smoke that opens an upgraded and a clean database. Cover bookmark add/remove/idempotence, genre selection, mode persistence, legacy `filter`-to-`mode` data preservation, and migration failure reporting.
4. Add a platform storage strategy document/code boundary if web requires distinct behavior. Do not silently make browser persistence disappear.

**Expected files:** `src/api/database/index.ts` and small repository/types/test helpers, Jest configuration/dependencies only if chosen, tests, `package.json`/lockfile/scripts, and README/developer docs.

### PR 4 — Prisma local-SQLite proof of concept (only if approved)

1. Define success criteria before installing dependencies: Android and iOS development builds start; a clean install runs migrations; an existing `CINEMA_CLUB` database preserves bookmarks/genre filters; queries are typed; bundle size/start time are acceptable; and web behavior is explicitly supported via a tested adapter or excluded by product decision.
2. Create a short-lived branch. Install the official packages exactly as their then-current compatible release requires:

   ```sh
   npm install --save-exact @prisma/client@latest @prisma/react-native@latest react-native-quick-base64
   npx prisma@latest migrate dev
   npx prisma@latest generate
   ```

   Re-check the official Prisma React Native README at that date; this feature is Early Access and package/schema instructions can change.

3. Add `prisma/schema.prisma`, migrations, and generated-client workflow. For existing tables, map rather than rename initially—for example `Bookmark.movieId @map("movie")` with `@@map("movie_bookmark")`, and a `GenreFilter` mapped to `genre_filter`. Keep `mode` as a string constrained in application code if the selected SQLite Prisma version does not support the desired enum mapping.
4. Write a one-time migration/import plan for the already deployed `CINEMA_CLUB` file. Test an upgrade fixture; never assume Prisma’s empty database migration alone preserves existing user data.
5. Add `@prisma/react-native` to Expo plugins. Under CNG, run clean Prebuild and inspect that migration-copy integration is present. Instantiate only `PrismaClient` from `@prisma/client/react-native`; do not import regular server `@prisma/client` into the app.
6. Apply pending migrations before rendering the data-dependent app UI. Treat failures as recoverable product errors where possible, log safely, and provide a user-support/reset path; never ignore a failed migration.
7. Begin with normal CRUD wrappers. Add reactive hooks only after proving rendering behavior, because Prisma warns that reactive queries can produce broad re-renders and mutations must go through the extended client to notify subscriptions.
8. Validate Android/iOS physical/emulator builds and a production-like bundle. Build/test Expo web separately. If web fails or is unsupported, either implement/test a web persistence adapter or abandon this client Prisma path; do not merge a broken web import.
9. Compare the resulting build, operational complexity, and test results against direct `expo-sqlite`; merge only if it meets the success criteria.

**Expected files if spike succeeds:** `prisma/schema.prisma`, `prisma/migrations/**`, a checked-in generated-client policy/output only if Prisma’s version requires it, a `src/api/database/prisma.ts` client/repository, refactored callers, `app.json`, package/lockfile, CNG-generated-output changes only per PR 2 convention, tests, and docs. No production Postgres URL is part of these files.

### PR 5 — Hosted data API + server-side Prisma/Postgres (future product capability)

1. Define requirements: identity provider, ownership/authorization model, synchronization/offline/conflict policy, deletion/export/retention, rate limits, API versioning, and operational owner.
2. Create a separately deployable API or deliberately evolve `server/movies-api.mjs` into a structured server. Keep TMDB proxy duties bounded and testable; do not mix privileged user-data access into unauthenticated routes.
3. Add server-only `prisma/schema.prisma`, Prisma CLI/client, migrations, a Postgres service, a server `DATABASE_URL`, and CI migration validation. Deploy migrations from trusted CI/release infrastructure, not the Expo application.
4. Authenticate each request and authorize every row by the verified user identity. Implement versioned endpoints such as `GET/PUT /v1/me/bookmarks` and `GET/PUT /v1/me/genre-filters`; validate payloads and return conflict/version information.
5. Add a mobile/web sync client. If retaining local SQLite, define an outbox, remote version/cursor, retries, conflict rules, and logout/data-deletion behavior. Network reachability is not synchronization.
6. Add Prisma Accelerate only on the server if connection pooling/global caching is demonstrated necessary. For per-user endpoints, choose cache TTL/keys/invalidation deliberately and verify no user data crosses cache boundaries.

**Expected files:** a server workspace/service, server Prisma schema/migrations, API tests/OpenAPI or equivalent contract, deployment configuration, secret references (not secret values), mobile sync repositories/tests, and architecture/runbook documentation.

## 6. Compatibility sources and re-verification commands

Version numbers below are an **as-of 2026-09-01 target**, not evergreen pins. The implementation agent must run Expo’s resolver and commit what it chooses.

| Topic                    | Current repository                                         | SDK 54 target / reliable source                                                                                                                                           | Implementation verification                                                                                                     |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Expo                     | `^53.0.27`, resolved 53.0.27                               | `^54.0.0`; [Expo SDK 54 release notes](https://expo.dev/changelog/sdk-54)                                                                                                 | `npx expo install expo@^54.0.0 --fix && npx expo install --check`                                                               |
| RN / React               | RN 0.79.6; React/DOM 19.0.0                                | SDK 54 release notes: RN 0.81 + React 19.1                                                                                                                                | `node -p "require('./node_modules/expo/package.json').version"`; inspect manifest/lock after resolver; `npx expo-doctor@latest` |
| Expo modules             | SDK 53 ranges (e.g., SQLite `~15.2.14`)                    | Do not predict each range; Expo’s SDK-aware installer is authoritative                                                                                                    | `npx expo install --fix && npx expo-doctor@latest`                                                                              |
| TypeScript               | `~5.8.3`                                                   | SDK 54 notes recommend `~5.9.2`; let resolver/doctor confirm                                                                                                              | `npx tsc --noEmit`                                                                                                              |
| Node                     | package requires `>=22`, CI Node 22                        | SDK 54 minimum is Node 20.19.4; retaining Node 22 satisfies both                                                                                                          | `node --version`, `npm ci`                                                                                                      |
| CNG / Prebuild           | native directories tracked                                 | [Expo CNG guide](https://docs.expo.dev/workflow/continuous-native-generation/)                                                                                            | `npx expo config --type public`; `npx expo prebuild --clean --no-install`; diff generated output                                |
| EAS                      | no EAS config/CLI dependency                               | [EAS Build setup](https://docs.expo.dev/build/setup/)                                                                                                                     | `npx eas-cli@latest build:configure`; `npx eas-cli@latest build --platform android --profile preview`                           |
| Prisma RN                | absent                                                     | [official Early Access README](https://github.com/prisma/react-native-prisma) and [announcement](https://www.prisma.io/blog/bringing-prisma-orm-to-react-native-and-expo) | re-read README, `npm view @prisma/react-native version`, native dev build + migration tests                                     |
| Prisma hosted/Accelerate | no database                                                | [Prisma Accelerate docs](https://www.prisma.io/docs/accelerate)                                                                                                           | server-only integration test/load measurement; validate no client secret                                                        |
| Expo SQLite web          | direct SQLite adapter currently used for all app platforms | [Expo SQLite docs](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/)—web is alpha and has WASM/header requirements                                                      | `npx expo export --platform web`, browser storage smoke under deployed response headers                                         |

Also consult the [Expo upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) just before implementation. It recommends incremental SDK upgrades, `expo install --fix`, `expo-doctor`, and either CNG regeneration or native-upgrade-helper work depending on the chosen workflow.

## 7. Risk register and mitigation

| Risk / gotcha                                        | Mitigation / acceptance condition                                                                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK 54 forces Android edge-to-edge                   | Screenshot/manual test all screens on API 36 and older supported Android; verify top/bottom insets, touch targets, keyboards, modals, footer/navigation.                                             |
| Reanimated v4/New Architecture incompatibility       | Let Expo choose package versions; follow Reanimated’s 3→4 guide; test animations/gesture navigation in native development and release builds.                                                        |
| CNG clean regeneration deletes a native-only setting | Inventory and port every intentional setting first; generate/diff on an isolated clean branch; retain raw folders until parity has been accepted.                                                    |
| EAS uses tracked native folders without Prebuild     | Do not expect EAS to sync app config while folders are tracked; either adopt ignored CNG output or own native upgrade-helper changes.                                                                |
| iOS validation cannot run locally                    | Install supported CocoaPods/Xcode or use EAS preview builds; do not mark iOS validated from TypeScript/web checks. SDK 54 requires at least Xcode 16.1; Xcode 26 is recommended for iOS 26 features. |
| Older device data breaks migration                   | Add clean-install and historical-database fixtures; back up/preserve rows in explicit migrations; support reset/recovery messaging.                                                                  |
| Prisma RN API changes/bugs                           | Isolate in a repository layer, exact-version lock, native-only POC, release notes monitoring, and a direct-SQLite rollback path.                                                                     |
| Prisma local client breaks Expo web                  | Treat web as a hard test gate; use a tested web adapter or do not adopt client Prisma. Do not infer support from the word “Expo.”                                                                    |
| Direct DB credentials are bundled                    | Enforce API-only hosted data access; audit `EXPO_PUBLIC_*` variables and build artifacts; server secret scanning/review.                                                                             |
| Accelerate cache leaks or stale user data            | Do not cache user-specific responses until keys/auth/invalidation are tested; begin without caching.                                                                                                 |
| Client database mistaken for sync                    | Document device-local scope; implement server sync protocol separately with auth/conflicts/outbox.                                                                                                   |
| Expo public API URL is confused with secret          | `EXPO_PUBLIC_MOVIES_API_URL` is safe to bundle; `TMDB_API_TOKEN`, `DATABASE_URL`, and Accelerate credentials are server secrets.                                                                     |
| Current CI misses runtime/native regressions         | Add deterministic Node/web checks and make EAS preview/manual device acceptance an explicit required release gate.                                                                                   |

## 8. Validation plan and CI matrix

### Developer scripts to add when their implementation phase introduces them

Use package scripts rather than ad-hoc CI-only commands:

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format:check": "prettier --check .",
    "test": "jest --runInBand",
    "check:expo": "expo install --check && expo-doctor",
    "prebuild:clean": "expo prebuild --clean",
    "web:export": "expo export --platform web"
  }
}
```

`test` is conditional on PR 3 introducing a supported Jest/Expo test setup; do not add a passing empty test script. If the team prefers a different Expo-supported runner, keep the command names and update this document/CI coherently. Do not make `check:expo` an unbounded PR blocker until its diagnostics are baselined and deterministic.

### Pull request CI (every PR, Linux, no production credentials)

| Job                          | Commands / assertions                                                                                                                                                          | Applies                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Install + static checks      | `npm ci`; `npm run lint`; `npm run typecheck`; `npm run format:check`                                                                                                          | All PRs                                                              |
| Existing API smoke           | `node --check server/movies-api.mjs`; start with dummy TMDB token; `curl --fail /health`; terminate exact PID                                                                  | All PRs touching app/server/config                                   |
| Expo consistency             | `npx expo install --check`; `npx expo-doctor@latest`; `npx expo-modules-autolinking verify -v`                                                                                 | SDK/dependency/native/CNG PRs; promote after stable baseline         |
| Unit/repository tests        | `npm test -- --ci` with mocked SQLite/API                                                                                                                                      | Once PR 3 lands                                                      |
| Web compile                  | `npx expo export --platform web`                                                                                                                                               | SDK/web/persistence PRs; add browser smoke when a runner is selected |
| Prisma generation/migrations | Server: `prisma validate`, `prisma generate`, isolated disposable database migration test. Client spike: generated schema/client plus native build gate, never a production DB | Only respective Prisma PRs                                           |

CI must not pass the actual TMDB token, database URLs, EAS tokens, or signing credentials into logs. Keep the current health smoke’s dummy token and use GitHub environments/secrets only for intentionally authorized deploy/release workflows.

### Native / EAS matrix (required before merge or release as indicated)

| Surface          | Development acceptance                                                                                                                                       | Release acceptance                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Android          | `npx expo run:android` or EAS development build on API 36/emulator and a physical device; start, DB migration, TMDB flows, filtering/bookmarks, edge-to-edge | EAS preview/production AAB; install and smoke a release binary                                           |
| iOS              | local `npx expo run:ios` once CocoaPods/Xcode works, or EAS development build; start, splash, secure store/SQLite, safe areas                                | EAS preview/TestFlight-style build; device smoke; signing handled by EAS or documented credentials       |
| Web              | local `npm run web` and exported production bundle; proxy API configured through public base URL                                                             | deployed-host header/storage smoke, especially if `expo-sqlite` web or a persistence adapter is retained |
| Prisma local POC | Android+iOS clean install and upgrade-from-existing DB migration tests                                                                                       | only after web decision, crash/error telemetry plan, and rollback tested                                 |
| Hosted Prisma    | API contract/auth/integration tests against non-production Postgres                                                                                          | migration rollout/rollback, backup/restore, load/auth/cache isolation verification                       |

For a normal change, do not automatically launch paid EAS builds on all PRs. Trigger EAS preview builds from a protected label/manual dispatch or after approval; require Android+iOS preview success for SDK/CNG/native-module/Prisma changes and require production profiles only at release. Record the EAS build URL/fingerprint in the PR.

### Functional smoke checklist

After SDK 54 and before a release, verify on web plus at least one device per native platform:

1. Launch/splash/font load without unhandled promise errors.
2. Discover now-playing/popular/upcoming pagination; search pagination; movie detail/trailer.
3. Public API URL works on localhost browser, LAN device, and deployed environment; TMDB token is not visible in the bundle.
4. Add/remove bookmarks; select/unselect genre filters; change filter mode; kill/relaunch and verify persistence.
5. Upgrade-database fixture preserves old bookmark/filter records.
6. Rotate through portrait layouts, status bar, keyboard, safe areas, footer, modals/back navigation, and Android predictive/standard back behavior.
7. Airplane/offline behavior presents a controlled error and still exposes locally persisted data where intended.
8. If Prisma is adopted: pending migration runs exactly once, reactive/nonreactive views update correctly, and migration failure has a supportable recovery path.

## 9. Fresh implementation-agent handoff

1. Read this document and re-run the four baseline commands in Section 6. The exact current npm registry versions will have changed; follow the official resolver rather than copying old version strings.
2. Preserve the clean `master` baseline and never reset/discard user work. Keep platform, CNG, and database PRs independent.
3. Use CNG config/plugins as the only long-lived place for native intent. Do not hand-patch generated output as the permanent solution.
4. Treat local SQLite Prisma and hosted Postgres Prisma as mutually different designs. Confirm product intent before starting either.
5. Leave all credentials out of source/control, logs, EAS public environment variables, and the Expo bundle.
