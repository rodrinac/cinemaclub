# CodeQL #3 (`js/request-forgery`) — TMDB proxy SSRF remediation specification

## Scope and objective

This specification is limited to `server/movies-api.mjs`. It addresses CodeQL alert **#3**, rule **`js/request-forgery`** (critical), reported on `fetch` at `server/movies-api.mjs:24-29` in commit `74cb917200cc3835734d5eb513d4c1182b7bcf45` (PR ref `refs/pull/45/head`). The alert identifies the request URL as depending on a user-provided value at `server/movies-api.mjs:64`, which is `requestUrl.searchParams`.

The proxy must remain read-only and retain the documented API:

- `GET /health`
- `GET /api/movies/now-playing`, `/api/movies/popular`, `/api/movies/upcoming`
- `GET /api/movies/:id`
- `GET /api/search/movies?query=...`
- `GET /api/genres`

The currently supported TMDB-shaped aliases should remain unless a separate compatibility-removal change is approved:

- `/api/movie/:id`
- `/api/movie/now_playing`, `/api/movie/popular`, `/api/movie/upcoming`
- `/api/genre/movie/list`
- `/api/search/movie`

No token belongs in source code. Continue using `TMDB_API_TOKEN` from the server environment as documented by `.env.template` and `README.md`.

## Findings and exact taint flow

### Current outbound-request construction

`server/movies-api.mjs` presently declares a fixed string base:

```js
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
```

but `tmdbRequest(path, params)` then builds and sends the request as follows:

```js
const url = new URL(`${TMDB_BASE_URL}${path}`);
url.search = params.toString();
const response = await fetch(url, {
  /* bearer token headers */
});
```

The string base is fixed, but neither `path` nor `params` has an explicit contract at the `tmdbRequest` boundary. CodeQL therefore correctly sees a request URL object whose `search` field is influenced by the incoming HTTP request. Concatenating a fixed base is also a brittle destination constraint: future route additions can accidentally pass a URL-shaped or traversal-containing `path` value to this generic helper.

### End-to-end user-controlled input flow

1. A remote client controls the HTTP request target: `request.url`, including its pathname and query string. The server currently parses it with:

   ```js
   const requestUrl = new URL(request.url, `http://${request.headers.host}`);
   ```

   The `Host` header participates only in parsing the inbound URL today; it is not intentionally sent to TMDB. It should nevertheless not be used as the parsing base because it is client controlled and unnecessary.

2. `requestUrl.pathname` controls route selection:

   - Exact keys in `routes` select a **static** TMDB path such as `/movie/popular`, `/search/movie`, or `/genre/movie/list`.
   - The regex `^/api/(?:movies/|movie/)(\d+)$` accepts the user-controlled movie-id capture. It interpolates that capture into `tmdbPath` as `/movie/${movieMatch[1]}`.
   - Unsupported pathnames return 404 and do not reach `tmdbRequest`.

3. More importantly for alert #3, `requestUrl.searchParams` consists entirely of client-provided query-name/value pairs. There is currently no name allowlist, duplicate handling, value validation, maximum length, or rebuilding into a trusted `URLSearchParams` object.

4. The handler passes both values directly into the sink helper:

   ```js
   await tmdbRequest(tmdbPath, requestUrl.searchParams);
   ```

5. `tmdbRequest` serializes the tainted `params` using `params.toString()` and assigns it to `url.search`; that URL is given to `fetch`. This is the precise path CodeQL reports:

   ```text
   remote request target
     -> request.url
     -> new URL(...).searchParams
     -> tmdbRequest(tmdbPath, requestUrl.searchParams)
     -> params.toString()
     -> url.search
     -> fetch(url)
   ```

6. The digit-only detail capture also enters `tmdbRequest` through `tmdbPath`. It cannot currently introduce a hostname because it is constrained by `\d+`, but it is still user input flowing into a URL-building helper. The remediation must turn it into a validated numeric identifier and ensure it is assigned only as a pathname segment on an already fixed destination URL.

## Related routes, consumers, configuration, and tests inspected

### App consumers and required query compatibility

`src/api/tmdb/index.ts` points Axios at `EXPO_PUBLIC_MOVIES_API_URL` (default `http://localhost:3001/api`), adds a locale as `language`, and injects `include_adult` for requests. It does not expose the TMDB bearer token.

The current application calls only the following proxy routes/query fields:

| Consumer                                       | Proxy request                                             | Required fields                                                   |
| ---------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/pages/Home/index.tsx`                     | `movies/now-playing`, `movies/popular`, `movies/upcoming` | `page`, plus Axios defaults `language` and `include_adult`        |
| `src/pages/MovieDetail/index.tsx`              | `movies/:movieId`                                         | `append_to_response=videos`, defaults                             |
| `src/components/HorizontalMovieCard/index.tsx` | `movies/:movie.id`                                        | `append_to_response=credits`, defaults                            |
| `src/pages/SearchMovie/index.tsx`              | `search/movies`                                           | user text `query`, `page`, `append_to_response=credits`, defaults |
| `src/pages/SearchFilters/index.tsx`            | `genres`                                                  | defaults                                                          |

The API documentation in `README.md` matches the canonical routes above. `.env.template` defines only the server token placeholder and the public proxy base URL.

There are no existing unit/integration test files. `.github/workflows/pull_requests.yml` already runs ESLint, Prettier, TypeScript, `node --check server/movies-api.mjs`, and a `/health` smoke test with a dummy token. That syntax check and health test should continue to pass; focused route and rejection tests should be added in a follow-up or alongside implementation if practical.

## Security and validation contract

### 1. Treat the proxy as an endpoint allowlist, not a general TMDB URL proxy

Replace the current string-to-string `routes` map with immutable route descriptors. A descriptor selects a static TMDB endpoint constant and a query policy; no request value may select a hostname, scheme, port, path prefix, or arbitrary TMDB endpoint.

Use one fixed URL object:

```js
const TMDB_BASE_URL = new URL("https://api.themoviedb.org/3/");
const TMDB_ORIGIN = "https://api.themoviedb.org";
const TMDB_API_PATH_PREFIX = "/3/";
```

Use endpoint constants without a leading slash, e.g. `movie/now_playing`, `movie/popular`, `movie/upcoming`, `genre/movie/list`, `search/movie`, and `movie`. These must be module constants only, never values taken from an HTTP request.

### 2. Enforce strict inbound pathname format and reject traversal

Parse the inbound target against a constant local base, not `request.headers.host`:

```js
const requestUrl = new URL(request.url, "http://localhost");
```

Before routing, require an origin-form request target (`request.url` starts with `/`) and inspect the raw path portion before `?`. Reject malformed percent encodings and traversal/path-separator encodings with a 400 response. This includes literal `.` / `..` segments, backslashes, and encoded forms such as `%2e`, `%2E`, `%2f`, `%2F`, `%5c`, and their double-encoded representations (`%252e`, `%252f`, `%255c`). Decode a bounded number of times (at least twice) for inspection; if decoding fails or a relevant percent-encoded separator/dot sequence remains after the bound, reject.

After that check, accept **only** an exact descriptor-map pathname or the detail pattern:

```text
/api/movies/<ASCII decimal digits>
/api/movie/<ASCII decimal digits>  (legacy alias)
```

The static descriptor keys already contain only literal ASCII path characters. The detail matcher must be anchored and use `[0-9]+`, not a partial match. Convert the capture to a number, require `Number.isSafeInteger(id)` and `id >= 0`, then stringify that validated number only while assigning the fixed TMDB movie path. No decoded slash, `%`, query marker, fragment marker, scheme, hostname, or path traversal text can therefore become part of an upstream path.

Even though the exact route allowlist alone prevents encoded traversal from matching a route, an explicit 400 rejection is required for clarity, defense in depth, and to prevent a future permissive route from accidentally changing that property.

### 3. Validate and reconstruct query parameters

Never forward `requestUrl.searchParams` itself. For each selected route descriptor, iterate its entries, reject unknown names and duplicate values (parameter pollution), validate each scalar value, then populate a fresh `new URLSearchParams()` with `set`.

Use the following policy, which includes every field used by current app consumers:

| Policy               | Allowed fields       | Validation                                                                                                                                                                      |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Common               | `language`           | Bounded BCP-47-like tag: ASCII letters/digits plus hyphen segments, 2–35 chars; examples `en`, `en-US`, `pt-BR`.                                                                |
| Common               | `include_adult`      | Exactly `true` or `false`.                                                                                                                                                      |
| Paged catalog/search | `page`               | ASCII decimal integer in TMDB's supported range, `1` through `500`; reject leading signs, decimal values, zero, and duplicates.                                                 |
| Detail/search        | `append_to_response` | One or a comma-separated list of the currently required TMDB expansions `videos` and `credits`, with no duplicates. Restrict this to detail/search descriptors that need it.    |
| Search only          | `query`              | One non-empty, at-most-500-character Unicode string with no C0/DEL control characters. Preserve ordinary spaces and punctuation; `URLSearchParams` safely percent-encodes them. |

Unknown query names, repeated names, invalid values, and invalid encoding must receive a 400 JSON error and must not call `fetch`. Do not silently drop them; rejection gives clients a stable contract and avoids differing upstream interpretations. The proxy need not accept arbitrary future TMDB parameters: its required functionality is the documented API and the fields actually consumed above.

### 4. Build and verify the final target before `fetch`

`tmdbRequest` must receive only a trusted descriptor plus the freshly reconstructed params (and an already-validated numeric movie id when applicable). It should create a fresh URL from `TMDB_BASE_URL`, set `pathname` from fixed prefix + static endpoint, set `search` from the reconstructed params, and verify all destination invariants immediately before fetching:

```js
url.protocol === "https:";
url.origin === TMDB_ORIGIN;
url.hostname === "api.themoviedb.org";
url.port === "";
url.pathname.startsWith(TMDB_API_PATH_PREFIX);
```

Also set `redirect: "error"` on `fetch`. Otherwise a redirect response could change the final outbound destination after the pre-fetch origin assertion. Preserve the existing JSON `Accept` header and bearer authorization header. A redirect or origin-invariant failure should use the existing generic 502 response, without exposing target details or token material.

## Exact proposed `server/movies-api.mjs` changes

1. Change `TMDB_BASE_URL` from a concatenated string base to the fixed `URL` object/constants described above.
2. Replace `routes` string values with frozen descriptors `{ endpoint, queryPolicy }`, each using a module-owned endpoint constant. Preserve each current canonical route and compatibility alias.
3. Add small helpers in this file:
   - `sendClientError(response, message)` for a 400 JSON error;
   - `getRawPathname(requestUrlText)` / `hasUnsafePathTraversal(rawPathname)` for origin-form, malformed-encoding, literal/encoded/double-encoded traversal rejection;
   - `parseMovieId(pathname)` that returns a safe integer or `undefined` only after the anchored matcher passes;
   - `validateQueryParams(input, policy)` that returns a new safe `URLSearchParams` or throws/returns a controlled 400 error;
   - `buildTmdbUrl(descriptor, movieId, safeParams)` that sets only static endpoint segments and validated numeric id, then asserts the five destination invariants.
4. Change `tmdbRequest` to accept `descriptor`, `movieId`, and `safeParams`; call `fetch` only on the result of `buildTmdbUrl`. Remove the template literal `${TMDB_BASE_URL}${path}` and remove `url.search = params.toString()` where `params` refers to the request-owned object.
5. In the request handler, parse from the constant `http://localhost` base, reject unsafe raw path input, select a descriptor/validated id, validate into fresh query params, and only then invoke `tmdbRequest`.
6. Retain `OPTIONS`, `GET`-only behavior, CORS response headers, `/health`, response-status passthrough for TMDB JSON responses, and generic 502 catch response.

The intended core implementation shape is:

```js
const tmdbRequest = async (descriptor, movieId, safeParams) => {
  const url = new URL(TMDB_BASE_URL);
  const endpoint = descriptor.endpoint;

  url.pathname = `${TMDB_API_PATH_PREFIX}${endpoint}`;
  if (movieId !== undefined) {
    url.pathname = `${TMDB_API_PATH_PREFIX}movie/${movieId}`;
  }
  url.search = safeParams.toString();

  if (
    url.protocol !== "https:" ||
    url.origin !== TMDB_ORIGIN ||
    url.hostname !== "api.themoviedb.org" ||
    url.port !== "" ||
    !url.pathname.startsWith(TMDB_API_PATH_PREFIX)
  ) {
    throw new Error("Refusing a non-TMDB target URL");
  }

  const response = await fetch(url, {
    redirect: "error",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return { body: await response.json(), status: response.status };
};
```

The handler must ensure `descriptor.endpoint` is one of its module constants before this helper is called. For static endpoints, no caller may provide `movieId`; for the movie-detail descriptor, the endpoint is fixed to `movie` and `movieId` is the parsed safe integer. This separation is deliberate: a validated number is the only request-derived value that can affect `pathname`, and it cannot affect the URL authority.

## Acceptance criteria and validation

After implementation, validate the following without using a real token in source or logs:

1. `node --check server/movies-api.mjs` passes.
2. The existing CI health smoke test still returns `200 {"status":"ok"}` with a dummy token.
3. With a controlled/stubbed `fetch` or a local focused test, each canonical route and listed alias produces only these TMDB pathname forms: `/3/movie/now_playing`, `/3/movie/popular`, `/3/movie/upcoming`, `/3/genre/movie/list`, `/3/search/movie`, and `/3/movie/<validated-id>`; every URL has origin `https://api.themoviedb.org`.
4. Verify normal app requests retain their accepted query values: language, include_adult, page, search query, `append_to_response=videos`, and `append_to_response=credits`.
5. Verify no outbound call occurs and a 400/404 is returned (400 for malformed/traversal/query validation; 404 for a well-formed unknown route) for examples including:
   - `/api/movies/../search/movies`
   - `/api/movies/%2e%2e/search/movies`
   - `/api/movies/%252e%252e%252fsearch/movies`
   - `/api/movies/123%2f..%2fsearch`
   - `/api/movies/123?next=https://attacker.example`
   - `/api/search/movies?query=x&query=y`
   - `/api/search/movies?query=x&page=0`
   - `/api/movies/123?append_to_response=videos%2Cconfiguration`
6. Run the repository's existing `npm run lint` and `npx prettier --check .` as appropriate for the implemented change. Re-run CodeQL after merge/analysis and confirm alert #3 is closed with no new `js/request-forgery` alert on the TMDB fetch.
