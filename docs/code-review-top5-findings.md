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

---

## 3) N+1 detail requests per search result card

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

---

## 4) Retry strategy for 429s has no cap/backoff policy

**Evidence**
- `src/api/tmdb/getQueued.ts`
  - On 429, `runQueuedRequest` recursively retries forever after fixed delay from `retry_after` (fallback 1s).
  - No max attempts, no jitter, no terminal error path.

**Why this matters**
- Reliability: requests may hang indefinitely under prolonged throttling; user never gets actionable failure.

**Suggested fix scope**
- Add bounded retries (`maxAttempts`) and exponential backoff + jitter.
- Surface a typed error after exhaustion so UI can render retry state.

---

## 5) Test coverage gap around Search + filter persistence paths

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

---

## Chosen #1 fix to implement now

**Fix:** ✅ Implemented — Search pagination state correctness and over-fetch prevention (`src/pages/SearchMovie/index.tsx`).

**Acceptance criteria**
1. Search requests stop when current page reaches `total_pages`.
2. No page 2+ request is made before user triggers pagination (scroll/end reached).
3. Duplicate `onEndReached` events do not trigger parallel requests for the same page.
4. Existing search results remain deduplicated and stable in order.
5. Regression tests cover the pagination guard and pass in CI.
