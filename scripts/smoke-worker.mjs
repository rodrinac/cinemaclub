import { FORBIDDEN_CORS_HEADER_NAMES, SUCCESS_CACHE_CONTROL } from "../server/tmdb-proxy-core.mjs";

const baseUrl = process.env.SMOKE_API_ORIGIN?.trim();
const corsAllowOrigin = process.env.SMOKE_CORS_ALLOW_ORIGIN?.trim() || "";

if (!baseUrl) {
  console.error("SMOKE_API_ORIGIN is required.");
  process.exit(1);
}

const normalizedOrigin = baseUrl.replace(/\/+$/, "");
const apiBaseUrl = `${normalizedOrigin}/api`;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { response, body };
};

const assertNoCorsHeaders = (response, label) => {
  for (const headerName of FORBIDDEN_CORS_HEADER_NAMES) {
    assert(
      !response.headers.has(headerName),
      `${label} unexpectedly included ${headerName}`,
    );
  }
};

const assertCorsHeaders = (response, label) => {
  assert(
    response.headers.get("access-control-allow-origin") === corsAllowOrigin,
    `${label} did not return the configured origin`,
  );
  assert(response.headers.get("vary") === "Origin", `${label} did not include Vary: Origin`);
};

const run = async () => {
  const health = await fetchJson(`${normalizedOrigin}/health`);
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

  const invalidPath = await fetchJson(`${normalizedOrigin}/api/..%2f..%2fetc/passwd`, {
    headers: corsAllowOrigin ? { Origin: corsAllowOrigin } : {},
  });
  assert(invalidPath.response.status === 400, `Invalid path returned ${invalidPath.response.status}`);

  const invalidMethod = await fetchJson(`${normalizedOrigin}/health`, {
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

    const sharePage = await fetch(`${normalizedOrigin}/share/movie/550?lang=en-US`);
    const sharePageHtml = await sharePage.text();
    assert(sharePage.status === 200, `Share page returned ${sharePage.status}`);
    assert(
      sharePage.headers.get("content-type") === "text/html; charset=utf-8",
      "Share page did not return HTML",
    );
    assert(/<meta property="og:title" content="[^"]+">/.test(sharePageHtml), "Share page has no og:title");
    assert(
      sharePageHtml.includes(`content="0;url=${corsAllowOrigin}/movie/550"`),
      "Share page does not redirect to the web app",
    );
  } else {
    assertNoCorsHeaders(health.response, "/health");
    assertNoCorsHeaders(firstPopular.response, "popular GET");
    assertNoCorsHeaders(invalidQuery.response, "invalid query response");
    assertNoCorsHeaders(invalidMethod.response, "invalid method response");
  }

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

  console.log("Cloudflare Worker smoke tests passed.");
};

await run();
