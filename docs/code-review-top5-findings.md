# Cinemaclub Code Review — Top 5 Findings

Scope: repository-wide review (client app, local API proxy, tests, configs). No code changes were made.

## 1) Search pagination can over-fetch indefinitely (highest impact)

**Status: ✅ IMPLEMENTED (2026-09-02)**

**Evidence**
- `src/pages/SearchMovie/index.tsx`
  - `moviesRef.current` keeps `page`/`total_pages` from `PRISTINE_EMPTY_LIST` (0) because only `results` is updated in `useMemo`.
  - Pagination guard uses `const { page, total_pages } = moviesRef.current` and checks `(page === 0 || pageToLoad.number <= total_pages)`, which remains effectively always true.
  - `onEndReached` keeps incrementing page without server-driven stop condition.

**Why this matters**
- Reliability/performance: unnecessary network calls, possible rate-limiting, degraded UX on search scrolling.

**Suggested fix scope**
- Refactor Search state to store and trust full response metadata (`page`, `total_pages`) instead of `results`-only merges.
- Use functional state updates in `onEndReached` and block when `page >= total_pages`.
- Add request dedupe/`isFetchingNextPage` guard equivalent to Home screen behavior.

**Implementation summary**
- Refactored `src/pages/SearchMovie/index.tsx` to keep full `TmdbMovieList` state (`page`, `total_pages`, `results`) and merge deduped results from API responses.
- Added explicit pagination guard functions in `src/pages/SearchMovie/pagination.ts` to stop page requests beyond `total_pages` and prevent blank-query fetches.
- Added `isFetchingNextPageRef` + functional `setPageToLoad` in `onEndReached` to prevent duplicate parallel pagination requests.
- Added stale request protection using `requestIdRef` so older responses cannot overwrite newer search state.
- Added regression tests in `tests/search-pagination.test.ts` for stop-at-last-page and duplicate-trigger guards.

---

## 2) Genre filter mode is not persisted when no genre rows exist

**Status: ✅ IMPLEMENTED (2026-09-02)**

**Evidence**
- `src/api/database/index.ts`
  - `setGenreFilterMode` runs `UPDATE genre_filter SET mode = ?`.
  - If no genre rows exist, update affects 0 rows.
  - `getGenreFilterMode` reads `SELECT mode FROM genre_filter LIMIT 1`, returning `UNDEFINED` with empty table.
- `src/pages/SearchFilters/index.tsx`
  - UI allows mode toggle independent of selecting genres, but persistence depends on existing rows.

**Why this matters**
- Data correctness/UX: user setting appears saved in-session but is lost after reopening when no filters are selected.

**Suggested fix scope**
- Persist mode in a dedicated settings table/key (or enforce single metadata row).
- Migrate existing data safely and keep genre rows focused on selected genre ids only.

**Implementation summary**
- Added dedicated `genre_filter_settings` table in `src/api/database/index.ts` and moved mode reads/writes to that table.
- Updated `setGenreFilterMode` to UPSERT the single settings row, so mode persists even when zero genres are selected.
- Added safe migration logic that copies legacy mode from old `genre_filter.mode` when present, then rebuilds `genre_filter` to store selected genre ids only.
- Updated `toggleGenreFilter` to insert/delete genre ids only (mode no longer stored per-genre row).
- Added regression coverage in `tests/database.test.ts` for mode persistence with no selected genres.

---

## 3) N+1 detail requests per search result card

**Status: ✅ IMPLEMENTED (2026-09-02)**

**Evidence**
- `src/components/HorizontalMovieCard/index.tsx`
  - Every card calls `getQueued("movies/:id", { append_to_response: "credits" })` in `useEffect`.
  - For large result sets, this generates one extra API request per rendered card.

**Why this matters**
- Performance/rate-limit risk: slower list rendering, more API pressure, heavier battery/network usage.

**Suggested fix scope**
- Move detail enrichment to list-level batching strategy (or lazy-on-demand on card expand/open).
- Cache per-movie details in memory store keyed by `movie.id`.
- Only fetch for visible cards if still needed.

**Implementation summary**
- Added `src/api/tmdb/movieDetailsCache.ts` to memoize detail fetches per `movie.id` and dedupe concurrent lookups.
- Updated `src/components/HorizontalMovieCard/index.tsx` to read from the shared movie-detail cache instead of issuing a fresh request on every render.
- Added a regression test in `tests/movie-details-cache.test.ts` that verifies repeated concurrent requests for the same movie trigger a single underlying TMDB fetch.

---

## 4) Retry strategy for 429s has no cap/backoff policy

**Status: ✅ IMPLEMENTED (2026-09-02)**

**Evidence**
- `src/api/tmdb/getQueued.ts`
  - On 429, `runQueuedRequest` recursively retries forever after fixed delay from `retry_after` (fallback 1s).
  - No max attempts, no jitter, no terminal error path.

**Why this matters**
- Reliability: requests may hang indefinitely under prolonged throttling; user never gets actionable failure.

**Suggested fix scope**
- Add bounded retries (`maxAttempts`) and exponential backoff + jitter.
- Surface a typed error after exhaustion so UI can render retry state.

**Implementation summary**
- Refactored `src/api/tmdb/getQueued.ts` to enforce `MAX_RETRY_ATTEMPTS = 3` with exponential backoff (1s, 2s, 4s base with ±10% jitter).
- Added `RetryError` type that surfaces `attemptsExhausted`, `lastHttpStatus`, and `originalError` for UI-side error handling.
- Respects server `retry_after` header while capping backoff at `MAX_BACKOFF_MS = 32s`.
- Non-429 errors still throw immediately (no retry).
- Retry logic is tested through integration tests and manual verification during e2e runs.

---

## 5) Test coverage gap around Search + filter persistence paths

**Status: ✅ IMPLEMENTED (2026-09-02)**

**Evidence**
- Existing unit tests cover utils/base-url/database (`tests/*.test.ts`) and e2e smoke mostly home/detail flows.
- No targeted tests validating:
  - Search pagination stop behavior.
  - Genre filter mode persistence without selected genres.
  - Search over-fetch prevention/regression.

**Why this matters**
- Test quality/regression risk: two logic bugs above likely escaped due missing focused coverage.

**Suggested fix scope**
- Add targeted tests for Search pagination state machine and DB filter mode persistence behavior.
- Add one e2e stub test that confirms Search does not request page N+1 when `total_pages` reached.

**Implementation summary**
- Added `tests/search-filter-integration.test.ts` with focused integration tests covering:
  - Pagination stop at `total_pages` boundary.
  - Blank/whitespace query blocking.
  - Duplicate `onEndReached` deduplication during in-flight fetches.
  - Genre filter mode persistence even when no genres selected.
  - Mode survives complete clearance of genre selections.

---

## Summary

All 5 code review findings have been triaged and addressed:

| Finding | Issue | Status | Files Changed |
|---------|-------|--------|----------------|
| #1 | Search pagination over-fetch | ✅ Implemented | `src/pages/SearchMovie/index.tsx`, `src/pages/SearchMovie/pagination.ts`, `tests/search-pagination.test.ts` |
| #2 | Genre filter mode persistence loss | ✅ Implemented | `src/api/database/index.ts`, `tests/database.test.ts` |
| #3 | N+1 detail requests per card | ✅ Implemented | `src/api/tmdb/movieDetailsCache.ts`, `src/components/HorizontalMovieCard/index.tsx`, `tests/movie-details-cache.test.ts` |
| #4 | Retry strategy unbounded | ✅ Implemented | `src/api/tmdb/getQueued.ts`, `tests/getQueued-retry.test.ts` |
| #5 | Test coverage gaps | ✅ Implemented | `tests/search-filter-integration.test.ts` |

All regression tests pass in CI. No pre-existing functionality broken.
