const TMDB_BASE_URL = new URL("https://api.themoviedb.org/3/");
const TMDB_ORIGIN = TMDB_BASE_URL.origin;
const TMDB_API_PATH_PREFIX = TMDB_BASE_URL.pathname;
const DEFAULT_CACHE_TTL_MS = 60_000;
export const DEFAULT_CACHE_MAX_ENTRIES = 100;
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;
const CORS_METHODS = "GET, OPTIONS";
const CORS_HEADERS = "Content-Type";

export const SUCCESS_CACHE_CONTROL = "public, max-age=60";
export const FORBIDDEN_CORS_HEADER_NAMES = Object.freeze([
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-allow-credentials",
  "access-control-expose-headers",
  "vary",
]);

const ENDPOINTS = Object.freeze({
  NOW_PLAYING: "movie/now_playing",
  POPULAR: "movie/popular",
  UPCOMING: "movie/upcoming",
  GENRES: "genre/movie/list",
  SEARCH: "search/movie",
  MOVIE: "movie",
});

const MOVIE_DETAIL_DESCRIPTOR = Object.freeze({
  endpoint: ENDPOINTS.MOVIE,
  policy: "detail",
  canonicalPath: "/api/movies/:id",
});

const ROUTES = Object.freeze({
  "/api/movies/now-playing": Object.freeze({
    endpoint: ENDPOINTS.NOW_PLAYING,
    policy: "paged",
    canonicalPath: "/api/movies/now-playing",
  }),
  "/api/movies/popular": Object.freeze({
    endpoint: ENDPOINTS.POPULAR,
    policy: "paged",
    canonicalPath: "/api/movies/popular",
  }),
  "/api/movies/upcoming": Object.freeze({
    endpoint: ENDPOINTS.UPCOMING,
    policy: "paged",
    canonicalPath: "/api/movies/upcoming",
  }),
  "/api/genres": Object.freeze({
    endpoint: ENDPOINTS.GENRES,
    policy: "common",
    canonicalPath: "/api/genres",
  }),
  "/api/search/movies": Object.freeze({
    endpoint: ENDPOINTS.SEARCH,
    policy: "search",
    canonicalPath: "/api/search/movies",
  }),
  "/api/movie/now_playing": Object.freeze({
    endpoint: ENDPOINTS.NOW_PLAYING,
    policy: "paged",
    canonicalPath: "/api/movies/now-playing",
  }),
  "/api/movie/popular": Object.freeze({
    endpoint: ENDPOINTS.POPULAR,
    policy: "paged",
    canonicalPath: "/api/movies/popular",
  }),
  "/api/movie/upcoming": Object.freeze({
    endpoint: ENDPOINTS.UPCOMING,
    policy: "paged",
    canonicalPath: "/api/movies/upcoming",
  }),
  "/api/genre/movie/list": Object.freeze({
    endpoint: ENDPOINTS.GENRES,
    policy: "common",
    canonicalPath: "/api/genres",
  }),
  "/api/search/movie": Object.freeze({
    endpoint: ENDPOINTS.SEARCH,
    policy: "search",
    canonicalPath: "/api/search/movies",
  }),
});

const POLICIES = Object.freeze({
  common: Object.freeze({
    allowedFields: new Set(["language", "include_adult"]),
  }),
  paged: Object.freeze({
    allowedFields: new Set(["language", "include_adult", "page"]),
  }),
  detail: Object.freeze({
    allowedFields: new Set(["language", "include_adult", "append_to_response"]),
  }),
  search: Object.freeze({
    allowedFields: new Set(["language", "include_adult", "page", "append_to_response", "query"]),
  }),
});

const ALLOWED_EXPANSIONS = new Set(["videos", "credits"]);

const writeLog = (logger, level, payload) => {
  const serializedPayload = JSON.stringify(payload);

  if (typeof logger?.[level] === "function") {
    logger[level](serializedPayload);
    return;
  }

  if (typeof logger?.log === "function") {
    logger.log(JSON.stringify({ level, ...payload }));
  }
};

const normalizeHeaders = (headers = {}) => {
  const normalized = {};

  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
};

const buildCorsHeaders = (corsAllowOrigin, includePreflightHeaders = false) => {
  if (!corsAllowOrigin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": corsAllowOrigin,
    Vary: "Origin",
    ...(includePreflightHeaders
      ? {
          "Access-Control-Allow-Methods": CORS_METHODS,
          "Access-Control-Allow-Headers": CORS_HEADERS,
        }
      : {}),
  };
};

const jsonResponse = (statusCode, payload, headers = {}) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
    body: JSON.stringify(payload),
  };
};

const emptyResponse = (statusCode, headers = {}) => {
  return {
    statusCode,
    headers,
    body: "",
  };
};

export const parseCorsAllowOrigin = (value) => {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("CORS allow origin must be a string when configured.");
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error("CORS allow origin cannot be blank or whitespace.");
  }

  if (trimmedValue.includes(",")) {
    throw new Error("CORS allow origin must be a single exact origin.");
  }

  return trimmedValue;
};

const parseConfiguredNumber = (value, name) => {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    throw new Error(`${name} cannot be blank.`);
  }

  const parsedValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive finite number.`);
  }

  return parsedValue;
};

export const parseRateLimitConfig = ({ rateLimitRps, rateLimitBurst }) => {
  const parsedRps = parseConfiguredNumber(rateLimitRps, "rate_limit_rps");
  const parsedBurst = parseConfiguredNumber(rateLimitBurst, "rate_limit_burst");

  if ((parsedRps == null) !== (parsedBurst == null)) {
    throw new Error("rate_limit_rps and rate_limit_burst must both be set or both be absent.");
  }

  if (parsedRps == null || parsedBurst == null) {
    return null;
  }

  if (parsedBurst < 1) {
    throw new Error("rate_limit_burst must be at least 1.");
  }

  return {
    refillRatePerSecond: parsedRps,
    burstCapacity: parsedBurst,
  };
};

export const createRateLimiter = ({ refillRatePerSecond, burstCapacity, now = () => Date.now() }) => {
  const buckets = new Map();

  return {
    consume(clientKey = "unknown") {
      const bucketKey = clientKey || "unknown";
      const nowMs = now();
      const bucket = buckets.get(bucketKey) ?? {
        tokens: burstCapacity,
        lastRefill: nowMs,
      };

      const elapsedSeconds = (nowMs - bucket.lastRefill) / 1000;
      if (elapsedSeconds > 0) {
        bucket.tokens = Math.min(
          burstCapacity,
          bucket.tokens + elapsedSeconds * refillRatePerSecond,
        );
        bucket.lastRefill = nowMs;
      }

      if (bucket.tokens < 1) {
        const retryAfter = Math.max(1, Math.ceil((1 - bucket.tokens) / refillRatePerSecond));
        buckets.set(bucketKey, bucket);
        return { allowed: false, retryAfter };
      }

      bucket.tokens -= 1;
      buckets.set(bucketKey, bucket);
      return { allowed: true, retryAfter: 0 };
    },
  };
};

export const createResponseCache = ({
  ttlMs = DEFAULT_CACHE_TTL_MS,
  maxEntries = DEFAULT_CACHE_MAX_ENTRIES,
  now = () => Date.now(),
} = {}) => {
  const entries = new Map();

  const evictExpiredEntry = (key, entry, referenceTime) => {
    if (referenceTime - entry.cachedAt >= ttlMs) {
      entries.delete(key);
      return true;
    }

    return false;
  };

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }

      const referenceTime = now();
      if (evictExpiredEntry(key, entry, referenceTime)) {
        return null;
      }

      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, { cachedAt: now(), value });

      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (!oldestKey) {
          break;
        }
        entries.delete(oldestKey);
      }
    },
    clear() {
      entries.clear();
    },
  };
};

export const hasUnsafePathTraversal = (rawPathname) => {
  if (typeof rawPathname !== "string") return true;

  if (rawPathname.includes("\\") || rawPathname.includes("\0")) {
    return true;
  }

  let current = rawPathname;
  const maxDecodes = 3;

  for (let i = 0; i < maxDecodes; i += 1) {
    if (/%(?:2e|2f|5c)/i.test(current)) {
      return true;
    }

    const segments = current.split("/");
    for (const segment of segments) {
      if (segment === "." || segment === "..") {
        return true;
      }
    }

    let decoded;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return true;
    }

    if (decoded === current) {
      break;
    }

    current = decoded;

    if (current.includes("\\") || current.includes("\0")) {
      return true;
    }
  }

  if (/%(?:2e|2f|5c)/i.test(current)) {
    return true;
  }

  for (const segment of current.split("/")) {
    if (segment === "." || segment === "..") {
      return true;
    }
  }

  return false;
};

const validateLanguage = (value) => {
  if (typeof value !== "string" || value.length < 2 || value.length > 35) {
    return false;
  }

  return /^[a-zA-Z0-9]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(value);
};

const validateIncludeAdult = (value) => value === "true" || value === "false";

const validatePage = (value) => {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    return false;
  }

  const parsedValue = Number.parseInt(value, 10);
  return parsedValue >= 1 && parsedValue <= 500 && String(parsedValue) === value;
};

const validateAppendToResponse = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  const parts = value.split(",");
  const seenValues = new Set();

  for (const part of parts) {
    if (!ALLOWED_EXPANSIONS.has(part) || seenValues.has(part)) {
      return false;
    }

    seenValues.add(part);
  }

  return true;
};

const validateQuery = (value) => {
  if (typeof value !== "string" || value.length < 1 || value.length > 500) {
    return false;
  }

  return !/[\x00-\x1F\x7F]/.test(value);
};

export const validateQueryParams = (searchParams, policyName) => {
  const policy = POLICIES[policyName];
  if (!policy) {
    throw new Error(`Invalid policy: ${policyName}`);
  }

  const safeParams = new URLSearchParams();
  const seenKeys = new Set();

  for (const [key, value] of searchParams.entries()) {
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate parameter: ${key}`);
    }

    seenKeys.add(key);

    if (!policy.allowedFields.has(key)) {
      throw new Error(`Unknown parameter: ${key}`);
    }

    let isValid = false;

    switch (key) {
      case "language":
        isValid = validateLanguage(value);
        break;
      case "include_adult":
        isValid = validateIncludeAdult(value);
        break;
      case "page":
        isValid = validatePage(value);
        break;
      case "append_to_response":
        isValid = validateAppendToResponse(value);
        break;
      case "query":
        isValid = validateQuery(value);
        break;
      default:
        isValid = false;
        break;
    }

    if (!isValid) {
      throw new Error(`Invalid value for parameter: ${key}`);
    }

    safeParams.set(key, value);
  }

  if (policyName === "search" && !safeParams.has("query")) {
    throw new Error("Missing required search query parameter.");
  }

  return safeParams;
};

const matchMovieIdRoute = (pathname) => {
  const match = pathname.match(/^\/api\/(?:movies|movie)\/([0-9]+)$/);
  if (!match) {
    return undefined;
  }

  const idText = match[1];
  const movieId = Number.parseInt(idText, 10);

  if (!Number.isSafeInteger(movieId) || movieId < 0 || String(movieId) !== idText) {
    return null;
  }

  return movieId;
};

export const matchRoute = (pathname) => {
  if (pathname === "/health") {
    return {
      kind: "health",
      supportedPath: true,
      canonicalPath: "/health",
    };
  }

  const movieId = matchMovieIdRoute(pathname);
  if (movieId !== undefined) {
    if (movieId === null) {
      return {
        kind: "invalid-movie-id",
        supportedPath: true,
        canonicalPath: "/api/movies/:id",
      };
    }

    return {
      kind: "tmdb",
      supportedPath: true,
      descriptor: MOVIE_DETAIL_DESCRIPTOR,
      movieId,
      canonicalPath: `/api/movies/${movieId}`,
    };
  }

  const descriptor = ROUTES[pathname];
  if (!descriptor) {
    return {
      kind: "unknown",
      supportedPath: false,
      canonicalPath: pathname,
    };
  }

  return {
    kind: "tmdb",
    supportedPath: true,
    descriptor,
    movieId: undefined,
    canonicalPath: descriptor.canonicalPath,
  };
};

const normalizeSearchParams = (searchParams) => {
  const sortedEntries = [...searchParams.entries()].sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );

  return new URLSearchParams(sortedEntries).toString();
};

export const buildCacheKey = (canonicalPath, safeParams) => {
  const normalizedQuery = normalizeSearchParams(safeParams);
  return normalizedQuery ? `${canonicalPath}?${normalizedQuery}` : canonicalPath;
};

export const buildTmdbUrl = (descriptor, movieId, safeParams) => {
  const url = new URL(TMDB_BASE_URL);

  if (movieId !== undefined) {
    url.pathname = `${TMDB_API_PATH_PREFIX}movie/${movieId}`;
  } else {
    url.pathname = `${TMDB_API_PATH_PREFIX}${descriptor.endpoint}`;
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

  return url;
};

const parseJsonResponse = async (response) => {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  return JSON.parse(responseText);
};

export const createTmdbProxy = ({
  getToken,
  fetchImpl = globalThis.fetch,
  log = console,
  corsAllowOrigin = null,
  rateLimitConfig = null,
  cache = createResponseCache(),
  now = () => Date.now(),
  upstreamTimeoutMs = DEFAULT_UPSTREAM_TIMEOUT_MS,
} = {}) => {
  if (typeof getToken !== "function") {
    throw new Error("A getToken function is required to create the TMDB proxy.");
  }

  const rateLimiter = rateLimitConfig ? createRateLimiter({ ...rateLimitConfig, now }) : null;

  return async ({
    method,
    pathname,
    rawPathname = pathname,
    searchParams = new URLSearchParams(),
    headers = {},
    requestId = "unknown",
    clientKey = "unknown",
    upstreamTimeoutMs: requestUpstreamTimeoutMs,
    resolveUpstreamTimeoutMs: resolveRequestUpstreamTimeoutMs,
  }) => {
    const normalizedHeaders = normalizeHeaders(headers);
    const routeMatch = matchRoute(pathname);
    const corsHeaders = routeMatch.supportedPath ? buildCorsHeaders(corsAllowOrigin, false) : {};

    if (hasUnsafePathTraversal(rawPathname)) {
      return jsonResponse(400, { error: "Invalid path format." }, corsHeaders);
    }

    if (method === "OPTIONS") {
      if (corsAllowOrigin && routeMatch.supportedPath) {
        return emptyResponse(204, buildCorsHeaders(corsAllowOrigin, true));
      }

      if (routeMatch.supportedPath) {
        return jsonResponse(405, { error: "Only GET requests are supported." }, corsHeaders);
      }

      return jsonResponse(404, { error: "Route not found." });
    }

    if (method !== "GET") {
      if (routeMatch.supportedPath) {
        return jsonResponse(405, { error: "Only GET requests are supported." }, corsHeaders);
      }

      return jsonResponse(404, { error: "Route not found." });
    }

    if (routeMatch.kind === "unknown") {
      return jsonResponse(404, { error: "Route not found." });
    }

    if (routeMatch.kind === "health") {
      return jsonResponse(200, { status: "ok" }, corsHeaders);
    }

    if (routeMatch.kind === "invalid-movie-id") {
      return jsonResponse(400, { error: "Invalid movie ID." }, corsHeaders);
    }

    let safeParams;
    try {
      safeParams = validateQueryParams(searchParams, routeMatch.descriptor.policy);
    } catch (error) {
      return jsonResponse(400, { error: error.message || "Invalid query parameters." }, corsHeaders);
    }

    const cacheKey = buildCacheKey(routeMatch.canonicalPath, safeParams);
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
      writeLog(log, "info", {
        kind: "tmdb_proxy_request",
        source: normalizedHeaders["x-amzn-trace-id"] ? "lambda" : "local",
        requestId,
        route: routeMatch.canonicalPath,
        method,
        status: cachedResponse.statusCode,
        cache: "hit",
      });

      return jsonResponse(cachedResponse.statusCode, cachedResponse.body, {
        ...corsHeaders,
        "Cache-Control": SUCCESS_CACHE_CONTROL,
      });
    }

    if (rateLimiter) {
      const rateLimitResult = rateLimiter.consume(clientKey);
      if (!rateLimitResult.allowed) {
        return jsonResponse(
          429,
          {
            error: "Too many requests. Please retry shortly.",
            parameters: {
              retry_after: rateLimitResult.retryAfter,
            },
          },
          {
            ...corsHeaders,
            "Retry-After": String(rateLimitResult.retryAfter),
          },
        );
      }
    }

    let token;
    try {
      token = await getToken();
    } catch (error) {
      writeLog(log, "error", {
        kind: "tmdb_proxy_error",
        requestId,
        route: routeMatch.canonicalPath,
        reason: "token_unavailable",
        message: error instanceof Error ? error.message : "Unknown token loading error",
      });
      return jsonResponse(502, { error: "Unable to reach the movie service." }, corsHeaders);
    }

    const upstreamUrl = buildTmdbUrl(routeMatch.descriptor, routeMatch.movieId, safeParams);
    const upstreamStartedAt = now();
    const resolvedRequestUpstreamTimeoutMs =
      typeof resolveRequestUpstreamTimeoutMs === "function"
        ? resolveRequestUpstreamTimeoutMs()
        : undefined;
    const effectiveUpstreamTimeoutMs =
      Number.isFinite(requestUpstreamTimeoutMs) && requestUpstreamTimeoutMs > 0
        ? requestUpstreamTimeoutMs
        : Number.isFinite(resolvedRequestUpstreamTimeoutMs) && resolvedRequestUpstreamTimeoutMs > 0
          ? resolvedRequestUpstreamTimeoutMs
          : upstreamTimeoutMs;

    try {
      const response = await fetchImpl(upstreamUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(effectiveUpstreamTimeoutMs),
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await parseJsonResponse(response);
      const durationMs = now() - upstreamStartedAt;
      const isSuccessful = response.status >= 200 && response.status < 300;

      if (isSuccessful) {
        cache.set(cacheKey, {
          statusCode: response.status,
          body,
        });
      }

      writeLog(log, "info", {
        kind: "tmdb_proxy_request",
        source: normalizedHeaders["x-amzn-trace-id"] ? "lambda" : "local",
        requestId,
        route: routeMatch.canonicalPath,
        method,
        status: response.status,
        upstreamStatus: response.status,
        cache: "miss",
        upstreamLatencyMs: durationMs,
      });

      return jsonResponse(response.status, body, {
        ...corsHeaders,
        ...(isSuccessful ? { "Cache-Control": SUCCESS_CACHE_CONTROL } : {}),
      });
    } catch (error) {
      writeLog(log, "error", {
        kind: "tmdb_proxy_error",
        requestId,
        route: routeMatch.canonicalPath,
        reason: "upstream_failure",
        timeout: error?.name === "AbortError" || error?.name === "TimeoutError",
        message: error instanceof Error ? error.message : "Unknown upstream error",
      });

      return jsonResponse(502, { error: "Unable to reach the movie service." }, corsHeaders);
    }
  };
};
