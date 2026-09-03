import { FORBIDDEN_CORS_HEADER_NAMES, SUCCESS_CACHE_CONTROL } from "../server/tmdb-proxy-core.mjs";

const baseStageUrl = process.env.SMOKE_STAGE_URL?.trim();
if (!baseStageUrl) {
  throw new Error("SMOKE_STAGE_URL is required.");
}

const apiBaseUrl = `${baseStageUrl.replace(/\/+$/, "")}/api`;
const corsAllowOrigin = process.env.SMOKE_CORS_ALLOW_ORIGIN?.trim() || null;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const readBody = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const fetchJson = async (path, init) => {
  const response = await fetch(path, init);
  const body = await readBody(response).catch(() => null);
  return { response, body };
};

const assertNoCorsHeaders = (response, label) => {
  for (const headerName of FORBIDDEN_CORS_HEADER_NAMES) {
    assert(
      response.headers.get(headerName) == null,
      `${label} unexpectedly included ${headerName}`,
    );
  }
};

const assertCorsHeaders = (response, label) => {
  assert(
    response.headers.get("access-control-allow-origin") === corsAllowOrigin,
    `${label} did not include the configured origin`,
  );
  assert(response.headers.get("vary") === "Origin", `${label} did not include Vary: Origin`);
};

const run = async () => {
  const health = await fetchJson(`${baseStageUrl}/health`);
  assert(health.response.status === 200, `GET /health returned ${health.response.status}`);
  assert(health.body?.status === "ok", "GET /health did not return { status: 'ok' }");

  const validRequestUrl = `${apiBaseUrl}/movies/popular?page=1&language=en-US`;
  const firstPopular = await fetchJson(validRequestUrl, {
    headers: corsAllowOrigin ? { Origin: corsAllowOrigin } : {},
  });

  assert(firstPopular.response.status === 200, `Popular request returned ${firstPopular.response.status}`);
  assert(
    firstPopular.response.headers.get("cache-control") === SUCCESS_CACHE_CONTROL,
    "Popular request did not return the cache header",
  );

  const secondPopular = await fetchJson(validRequestUrl, {
    headers: corsAllowOrigin ? { Origin: corsAllowOrigin } : {},
  });
  assert(secondPopular.response.status === 200, "Repeated popular request failed");
  assert(
    secondPopular.response.headers.get("cache-control") === SUCCESS_CACHE_CONTROL,
    "Repeated popular request lost the cache header",
  );

  const invalidQuery = await fetchJson(`${apiBaseUrl}/movies/popular?unknown_param=1`, {
    headers: corsAllowOrigin ? { Origin: corsAllowOrigin } : {},
  });
  assert(invalidQuery.response.status === 400, `Invalid query returned ${invalidQuery.response.status}`);

  const invalidPath = await fetchJson(`${baseStageUrl}/api/..%2f..%2fetc/passwd`, {
    headers: corsAllowOrigin ? { Origin: corsAllowOrigin } : {},
  });
  assert(invalidPath.response.status === 400, `Invalid path returned ${invalidPath.response.status}`);

  const invalidMethod = await fetchJson(`${baseStageUrl}/health`, {
    method: "POST",
    headers: corsAllowOrigin ? { Origin: corsAllowOrigin } : {},
  });
  assert(invalidMethod.response.status === 405, `POST /health returned ${invalidMethod.response.status}`);

  if (corsAllowOrigin) {
    assertCorsHeaders(health.response, "/health");
    assertCorsHeaders(firstPopular.response, "popular GET");
    assertCorsHeaders(invalidQuery.response, "invalid query response");

    const preflight = await fetch(`${apiBaseUrl}/movies/popular`, {
      method: "OPTIONS",
      headers: {
        Origin: corsAllowOrigin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    assert(preflight.status === 204, `Preflight returned ${preflight.status}`);
    assertCorsHeaders(preflight, "popular preflight");
    assert(
      preflight.headers.get("access-control-allow-methods") === "GET, OPTIONS",
      "Preflight returned the wrong allowed methods",
    );
    assert(
      preflight.headers.get("access-control-allow-headers") === "Content-Type",
      "Preflight returned the wrong allowed headers",
    );
  } else {
    assertNoCorsHeaders(health.response, "/health");
    assertNoCorsHeaders(firstPopular.response, "popular GET");
    assertNoCorsHeaders(invalidQuery.response, "invalid query response");
    assertNoCorsHeaders(invalidMethod.response, "invalid method response");
  }

  // Hosted rate limiting (API Gateway stage/method throttling) is intentionally not exercised
  // here: it's enforced by a distributed, best-effort token bucket rather than an exact
  // per-millisecond counter, which made burst-triggering assertions flaky in CI. We still
  // sanity-check that a normal handful of requests succeeds without being throttled.
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      fetchJson(`${apiBaseUrl}/movies/popular?page=${index + 30}&language=en-US`, {
        headers: corsAllowOrigin ? { Origin: corsAllowOrigin } : {},
      }),
    ),
  );

  assert(
    results.every(({ response }) => response.status !== 429),
    "Received an unexpected 429 for a normal request burst",
  );

  console.log("AWS proxy smoke tests passed.");
};

await run();
