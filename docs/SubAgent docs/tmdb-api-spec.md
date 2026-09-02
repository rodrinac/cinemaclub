# TMDB Proxy API — refined implementation spec

## 1. Purpose

This project uses a small local TMDB proxy so the app never calls TMDB directly from the client. The API keeps the bearer token on the server, validates request parameters, and forwards only the endpoints the app actually needs.

The server must be read-only, low-overhead, and safe for local development and web app usage.

---

## 2. Build workflow

### Local setup

```bash
npm install
cp .env.template .env
```

Then set:

```bash
TMDB_API_TOKEN=your_tmdb_read_access_token
```

Start the API:

```bash
npm run api
```

The app should then be available on:

```text
http://localhost:3001
```

### Smoke checks

```bash
curl http://localhost:3001/health
curl "http://localhost:3001/api/movies/popular?page=1&language=en-US"
```

### CI checks

```bash
npm test
npm run test:e2e:stub
```

The repository already runs these via GitHub Actions, and the TMDB token is provided through `TMDB_API_TOKEN` in CI.

---

## 3. Runtime contract

- Base URL: `http://localhost:3001`
- Protocol: HTTP/1.1
- Methods: `GET` and `OPTIONS` only
- Response format: JSON
- CORS: `Access-Control-Allow-Origin: *`
- Token handling: server-side only
- Fail closed on invalid path/query input

The service should log operational errors but never expose stack traces, internal URLs, or bearer tokens to clients.

---

## 4. Supported endpoints

These are the endpoints the app actually uses and the ones the proxy should support.

| Route | TMDB target | Notes |
| --- | --- | --- |
| `GET /health` | n/a | Health check for local development and smoke tests |
| `GET /api/movies/now-playing` | `GET /3/movie/now_playing` | Paged movie list |
| `GET /api/movies/popular` | `GET /3/movie/popular` | Paged movie list |
| `GET /api/movies/upcoming` | `GET /3/movie/upcoming` | Paged movie list |
| `GET /api/movies/:id` | `GET /3/movie/:id` | Movie detail record |
| `GET /api/search/movies` | `GET /3/search/movie` | Search endpoint requiring `query` |
| `GET /api/genres` | `GET /3/genre/movie/list` | Genre catalog |

The implementation also accepts a few compatibility aliases already present in the application code:

- `/api/movie/now_playing`
- `/api/movie/popular`
- `/api/movie/upcoming`
- `/api/search/movie`
- `/api/genre/movie/list`

These aliases should resolve to the same TMDB endpoints and behave identically to the canonical plural routes.

---

## 5. Query parameter rules

Allowed fields are intentionally restricted to the app's actual use cases.

### Common fields

- `language`: ISO-like language code, e.g. `en`, `en-US`, `pt-BR`
- `include_adult`: `true` or `false`

### Paged lists

- `page`: integer from 1 to 500

### Movie detail

- `append_to_response`: comma-separated subset of `videos,credits`

### Search

- `query`: required, 1-500 characters, no control characters
- `page`: integer from 1 to 500
- `language`: optional
- `include_adult`: optional
- `append_to_response`: optional, same validation rules as movie detail

Unknown or duplicated query parameters must return `400 Bad Request`.

---

## 6. Data and security constraints

- Only `GET` requests are accepted.
- Paths must not contain traversal patterns like `..`, encoded slashes, or backslashes.
- TMDB URLs are restricted to `https://api.themoviedb.org` and the `/3/` prefix only.
- Authorization uses the TMDB bearer token as a server-only environment variable.
- No client request may include or echo the TMDB bearer token.
- Response bodies should be forwarded as JSON from TMDB whenever the upstream succeeds.

---

## 7. Rate limiting

The API should protect upstream TMDB calls with a small in-memory token bucket.

Recommended defaults:

- steady-state rate: 5 requests/second
- burst capacity: 5 tokens
- key: client IP address (with `x-forwarded-for` support when behind a proxy)

Behavior:

- The first 5 requests are allowed immediately.
- Additional requests are queued by token refill until the bucket recharges.
- Requests above the burst limit return `429 Too Many Requests`.
- Include a `Retry-After` header with a second-level recommendation.

This is intentionally simple, low-maintenance, and reasonable for a local or low-volume read-only proxy. It is not a distributed multi-instance limiter.

---

## 8. Error handling

### 2xx

- `200 OK` on successful TMDB requests

### 4xx

- `400 Bad Request` for malformed URLs, traversal attempts, invalid query params, or missing search query
- `404 Not Found` when the route is not recognized
- `405 Method Not Allowed` for non-GET requests
- `429 Too Many Requests` when the rate limit is exceeded

### 5xx

- `502 Bad Gateway` for upstream connectivity failures or unexpected TMDB errors

Example error payload:

```json
{
  "error": "Too many requests. Please retry shortly."
}
```

Do not leak internal implementation details, stack traces, or tokens in the body.

---

## 9. Build / validation checklist

The implementation is complete when all of the following are true:

- [ ] `npm install` succeeds.
- [ ] `TMDB_API_TOKEN` is configured from `.env` and never committed.
- [ ] `npm run api` starts the service on port `3001`.
- [ ] `GET /health` returns `{ "status": "ok" }`.
- [ ] All supported TMDB-backed routes resolve correctly.
- [ ] Search requires `query` and filters unknown params.
- [ ] Invalid movie IDs and unsafe paths are rejected.
- [ ] Rate limiting kicks in after repeated requests from the same client.
- [ ] `429` responses include a `Retry-After` header.
- [ ] Test suite passes for the API server and supporting smoke checks.

---

## 10. Notes for future expansion

This service intentionally stays focused on the app's read-only use cases.

Potential future enhancements, if needed later, include:

1. More TMDB endpoints such as credits/trailers or person lookups.
2. Shared cache for popular or frequently repeated responses.
3. An IP+user-agent based limiter for multi-client environments.
4. A hardened production deployment with authenticated API keys, secrets management, and deployment automation.

For this app, the current scope is intentionally small and easy to reason about.
