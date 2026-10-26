import { SHARE_PAGE_HEADERS, buildFallbackSharePage, buildMovieSharePage } from "./share-page.mjs";

const TMDB_BASE_URL = new URL("https://api.themoviedb.org/3/");
const TMDB_ORIGIN = TMDB_BASE_URL.origin;
const TMDB_API_PATH_PREFIX = TMDB_BASE_URL.pathname;
const DEFAULT_CACHE_TTL_MS = 60_000;
export const DEFAULT_CACHE_MAX_ENTRIES = 100;
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;
export const PITCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// Keeps the TMDB lookup plus the Bedrock call inside the 10s Lambda ceiling.
const PITCH_TMDB_TIMEOUT_MS = 3_000;
// Pitches cost a Bedrock call per cache miss, so they are always throttled per
// client, independently of the optional proxy-wide rate limit.
export const DEFAULT_PITCH_RATE_LIMIT = Object.freeze({
  refillRatePerSecond: 0.2,
  burstCapacity: 5,
});
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
  DISCOVER: "discover/movie",
  GENRES: "genre/movie/list",
  SEARCH: "search/movie",
  MOVIE: "movie",
});

const MOVIE_DETAIL_DESCRIPTOR = Object.freeze({
  endpoint: ENDPOINTS.MOVIE,
  policy: "detail",
  canonicalPath: "/api/movies/:id",
});

const MOVIE_PITCH_DESCRIPTOR = Object.freeze({
  endpoint: ENDPOINTS.MOVIE,
  policy: "common",
  canonicalPath: "/api/movies/:id/pitch",
  // Keywords, credits and certifications give the model hooks beyond the overview.
  buildUpstreamParams: (safeParams) => {
    const upstreamParams = new URLSearchParams(safeParams);
    upstreamParams.set("append_to_response", "keywords,credits,release_dates");
    return upstreamParams;
  },
});

const MOVIE_SHARE_DESCRIPTOR = Object.freeze({
  endpoint: ENDPOINTS.MOVIE,
  policy: "share",
  canonicalPath: "/share/movie/:id",
  // `lang` is the sharer's language, so previews read in the language the link was sent in.
  buildUpstreamParams: (safeParams) => {
    const upstreamParams = new URLSearchParams();
    if (safeParams.has("lang")) {
      upstreamParams.set("language", safeParams.get("lang"));
    }
    return upstreamParams;
  },
});

const DEFAULT_SHARE_LANGUAGE = "en-US";

const DAY_MS = 24 * 60 * 60 * 1000;

const toTmdbDate = (timestampMs) => new Date(timestampMs).toISOString().slice(0, 10);

const NOW_PLAYING_DESCRIPTOR = Object.freeze({
  endpoint: ENDPOINTS.NOW_PLAYING,
  policy: "regional",
  canonicalPath: "/api/movies/now-playing",
});

// TMDB's own upcoming list counts any later release in any country, so movies
// already in theaters show up there. Discover with a release-date floor keeps
// the tab to films that are not out yet: in the client's region when it sends
// one (theatrical releases), otherwise anywhere.
const UPCOMING_DESCRIPTOR = Object.freeze({
  endpoint: ENDPOINTS.DISCOVER,
  policy: "regional",
  canonicalPath: "/api/movies/upcoming",
  buildUpstreamParams: (safeParams, nowMs) => {
    const upstreamParams = new URLSearchParams(safeParams);
    const tomorrow = toTmdbDate(nowMs + DAY_MS);

    upstreamParams.set("sort_by", "popularity.desc");

    if (upstreamParams.has("region")) {
      upstreamParams.set("release_date.gte", tomorrow);
      upstreamParams.set("with_release_type", "2|3");
      // Regional re-releases of old films would otherwise count as upcoming.
      upstreamParams.set("primary_release_date.gte", toTmdbDate(nowMs - 365 * DAY_MS));
    } else {
      upstreamParams.set("primary_release_date.gte", tomorrow);
    }

    return upstreamParams;
  },
});

// TMDB's top_rated list lets low-vote new releases outrank the classics, so
// rank by rating among films with a substantial vote count instead.
const TOP_RATED_DESCRIPTOR = Object.freeze({
  endpoint: ENDPOINTS.DISCOVER,
  policy: "paged",
  canonicalPath: "/api/movies/top-rated",
  buildUpstreamParams: (safeParams) => {
    const upstreamParams = new URLSearchParams(safeParams);
    upstreamParams.set("sort_by", "vote_average.desc");
    upstreamParams.set("vote_count.gte", "5000");
    return upstreamParams;
  },
});

const ROUTES = Object.freeze({
  "/api/movies/now-playing": NOW_PLAYING_DESCRIPTOR,
  "/api/movies/popular": Object.freeze({
    endpoint: ENDPOINTS.POPULAR,
    policy: "paged",
    canonicalPath: "/api/movies/popular",
  }),
  "/api/movies/top-rated": TOP_RATED_DESCRIPTOR,
  "/api/movies/upcoming": UPCOMING_DESCRIPTOR,
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
  "/api/movie/now_playing": NOW_PLAYING_DESCRIPTOR,
  "/api/movie/popular": Object.freeze({
    endpoint: ENDPOINTS.POPULAR,
    policy: "paged",
    canonicalPath: "/api/movies/popular",
  }),
  "/api/movie/upcoming": UPCOMING_DESCRIPTOR,
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
  regional: Object.freeze({
    allowedFields: new Set(["language", "include_adult", "page", "region"]),
  }),
  share: Object.freeze({
    allowedFields: new Set(["lang"]),
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

const validateRegion = (value) => typeof value === "string" && /^[A-Z]{2}$/.test(value);

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
      case "lang":
        isValid = validateLanguage(value);
        break;
      case "include_adult":
        isValid = validateIncludeAdult(value);
        break;
      case "region":
        isValid = validateRegion(value);
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

const matchMovieShareRoute = (pathname) => {
  const match = pathname.match(/^\/share\/movie\/([0-9]+)$/);
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

const matchMoviePitchRoute = (pathname) => {
  const match = pathname.match(/^\/api\/movies\/([0-9]+)\/pitch$/);
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

  const shareMovieId = matchMovieShareRoute(pathname);
  if (shareMovieId !== undefined) {
    if (shareMovieId === null) {
      return {
        kind: "invalid-movie-id",
        supportedPath: true,
        canonicalPath: "/share/movie/:id",
      };
    }

    return {
      kind: "share",
      supportedPath: true,
      descriptor: MOVIE_SHARE_DESCRIPTOR,
      movieId: shareMovieId,
      canonicalPath: `/share/movie/${shareMovieId}`,
    };
  }

  const pitchMovieId = matchMoviePitchRoute(pathname);
  if (pitchMovieId !== undefined) {
    if (pitchMovieId === null) {
      return {
        kind: "invalid-movie-id",
        supportedPath: true,
        canonicalPath: "/api/movies/:id/pitch",
      };
    }

    return {
      kind: "pitch",
      supportedPath: true,
      descriptor: MOVIE_PITCH_DESCRIPTOR,
      movieId: pitchMovieId,
      canonicalPath: `/api/movies/${pitchMovieId}/pitch`,
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
  generateMoviePitch = null,
  pitchCache = createResponseCache({ ttlMs: PITCH_CACHE_TTL_MS, now }),
  pitchRateLimitConfig = DEFAULT_PITCH_RATE_LIMIT,
  shareAppOrigin = null,
} = {}) => {
  if (typeof getToken !== "function") {
    throw new Error("A getToken function is required to create the TMDB proxy.");
  }

  const rateLimiter = rateLimitConfig ? createRateLimiter({ ...rateLimitConfig, now }) : null;
  const pitchRateLimiter = createRateLimiter({ ...pitchRateLimitConfig, now });

  const rateLimitedResponse = (retryAfter, corsHeaders) =>
    jsonResponse(
      429,
      {
        error: "Too many requests. Please retry shortly.",
        parameters: {
          retry_after: retryAfter,
        },
      },
      {
        ...corsHeaders,
        "Retry-After": String(retryAfter),
      },
    );

  const resolveEffectiveUpstreamTimeoutMs = (requestUpstreamTimeoutMs, resolveRequestUpstreamTimeoutMs) => {
    const resolvedRequestUpstreamTimeoutMs =
      typeof resolveRequestUpstreamTimeoutMs === "function"
        ? resolveRequestUpstreamTimeoutMs()
        : undefined;

    return Number.isFinite(requestUpstreamTimeoutMs) && requestUpstreamTimeoutMs > 0
      ? requestUpstreamTimeoutMs
      : Number.isFinite(resolvedRequestUpstreamTimeoutMs) && resolvedRequestUpstreamTimeoutMs > 0
        ? resolvedRequestUpstreamTimeoutMs
        : upstreamTimeoutMs;
  };

  const handlePitchRequest = async ({
    routeMatch,
    safeParams,
    corsHeaders,
    requestId,
    clientKey,
    effectiveUpstreamTimeoutMs,
  }) => {
    if (typeof generateMoviePitch !== "function") {
      return jsonResponse(503, { error: "Movie pitches are unavailable." }, corsHeaders);
    }

    const cacheKey = buildCacheKey(routeMatch.canonicalPath, safeParams);
    const cachedPitch = pitchCache.get(cacheKey);

    if (cachedPitch) {
      writeLog(log, "info", {
        kind: "movie_pitch_request",
        requestId,
        route: routeMatch.descriptor.canonicalPath,
        status: 200,
        cache: "hit",
      });

      return jsonResponse(200, cachedPitch, {
        ...corsHeaders,
        "Cache-Control": SUCCESS_CACHE_CONTROL,
      });
    }

    for (const limiter of [rateLimiter, pitchRateLimiter]) {
      const rateLimitResult = limiter?.consume(clientKey);
      if (rateLimitResult && !rateLimitResult.allowed) {
        return rateLimitedResponse(rateLimitResult.retryAfter, corsHeaders);
      }
    }

    let movie;
    try {
      const token = await getToken();
      const response = await fetchImpl(
        buildTmdbUrl(
          routeMatch.descriptor,
          routeMatch.movieId,
          routeMatch.descriptor.buildUpstreamParams(safeParams, now()),
        ),
        {
          redirect: "error",
          signal: AbortSignal.timeout(Math.min(effectiveUpstreamTimeoutMs, PITCH_TMDB_TIMEOUT_MS)),
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 404) {
        return jsonResponse(404, { error: "Movie not found." }, corsHeaders);
      }

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`TMDB responded with status ${response.status}`);
      }

      movie = await parseJsonResponse(response);
    } catch (error) {
      writeLog(log, "error", {
        kind: "movie_pitch_error",
        requestId,
        route: routeMatch.descriptor.canonicalPath,
        reason: "upstream_failure",
        message: error instanceof Error ? error.message : "Unknown upstream error",
      });
      return jsonResponse(502, { error: "Unable to reach the movie service." }, corsHeaders);
    }

    const pitchStartedAt = now();
    let pitch;
    try {
      pitch = await generateMoviePitch({
        movie,
        language: safeParams.get("language") || "en-US",
      });
    } catch (error) {
      writeLog(log, "error", {
        kind: "movie_pitch_error",
        requestId,
        route: routeMatch.descriptor.canonicalPath,
        reason: "generation_failure",
        message: error instanceof Error ? error.message : "Unknown generation error",
      });
      return jsonResponse(502, { error: "Unable to generate a pitch right now." }, corsHeaders);
    }

    const body = { id: routeMatch.movieId, pitch: pitch.pitch, moods: pitch.moods };
    pitchCache.set(cacheKey, body);

    writeLog(log, "info", {
      kind: "movie_pitch_request",
      requestId,
      route: routeMatch.descriptor.canonicalPath,
      status: 200,
      cache: "miss",
      generationLatencyMs: now() - pitchStartedAt,
    });

    return jsonResponse(200, body, {
      ...corsHeaders,
      "Cache-Control": SUCCESS_CACHE_CONTROL,
    });
  };

  const handleShareRequest = async ({
    routeMatch,
    safeParams,
    requestId,
    clientKey,
    effectiveUpstreamTimeoutMs,
  }) => {
    if (!shareAppOrigin) {
      return jsonResponse(503, { error: "Share pages are unavailable." });
    }

    const language = safeParams.get("lang") ?? DEFAULT_SHARE_LANGUAGE;
    const htmlResponse = (statusCode, body, headers = {}) => ({
      statusCode,
      headers: { ...SHARE_PAGE_HEADERS, ...headers },
      body,
    });
    const logShare = (level, fields) =>
      writeLog(log, level, {
        kind: "movie_share_request",
        requestId,
        route: routeMatch.descriptor.canonicalPath,
        ...fields,
      });

    const cacheKey = buildCacheKey(routeMatch.canonicalPath, safeParams);
    const cachedPage = cache.get(cacheKey);

    if (cachedPage) {
      logShare("info", { status: 200, cache: "hit" });
      return htmlResponse(200, cachedPage.html, { "Cache-Control": SUCCESS_CACHE_CONTROL });
    }

    if (rateLimiter) {
      const rateLimitResult = rateLimiter.consume(clientKey);
      if (!rateLimitResult.allowed) {
        return rateLimitedResponse(rateLimitResult.retryAfter, {});
      }
    }

    // Failures still render a page that redirects, so a person who taps a
    // shared link always lands in the app even when the preview is generic.
    const fallbackPage = (statusCode, redirectPath) =>
      htmlResponse(
        statusCode,
        buildFallbackSharePage({ redirectPath, language, appOrigin: shareAppOrigin }),
      );

    let movie;
    try {
      const token = await getToken();
      const response = await fetchImpl(
        buildTmdbUrl(
          routeMatch.descriptor,
          routeMatch.movieId,
          routeMatch.descriptor.buildUpstreamParams(safeParams, now()),
        ),
        {
          redirect: "error",
          signal: AbortSignal.timeout(effectiveUpstreamTimeoutMs),
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 404) {
        logShare("info", { status: 404, upstreamStatus: 404, cache: "miss" });
        return fallbackPage(404, "/");
      }

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`TMDB responded with status ${response.status}`);
      }

      movie = await parseJsonResponse(response);
    } catch (error) {
      writeLog(log, "error", {
        kind: "movie_share_error",
        requestId,
        route: routeMatch.descriptor.canonicalPath,
        reason: "upstream_failure",
        message: error instanceof Error ? error.message : "Unknown upstream error",
      });
      return fallbackPage(502, `/movie/${routeMatch.movieId}`);
    }

    const html = buildMovieSharePage({
      movie,
      movieId: routeMatch.movieId,
      language,
      appOrigin: shareAppOrigin,
    });
    cache.set(cacheKey, { html });
    logShare("info", { status: 200, cache: "miss" });

    return htmlResponse(200, html, { "Cache-Control": SUCCESS_CACHE_CONTROL });
  };

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

    if (routeMatch.kind === "share") {
      return handleShareRequest({
        routeMatch,
        safeParams,
        requestId,
        clientKey,
        effectiveUpstreamTimeoutMs: resolveEffectiveUpstreamTimeoutMs(
          requestUpstreamTimeoutMs,
          resolveRequestUpstreamTimeoutMs,
        ),
      });
    }

    if (routeMatch.kind === "pitch") {
      return handlePitchRequest({
        routeMatch,
        safeParams,
        corsHeaders,
        requestId,
        clientKey,
        effectiveUpstreamTimeoutMs: resolveEffectiveUpstreamTimeoutMs(
          requestUpstreamTimeoutMs,
          resolveRequestUpstreamTimeoutMs,
        ),
      });
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
        return rateLimitedResponse(rateLimitResult.retryAfter, corsHeaders);
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

    const upstreamParams = routeMatch.descriptor.buildUpstreamParams
      ? routeMatch.descriptor.buildUpstreamParams(safeParams, now())
      : safeParams;
    const upstreamUrl = buildTmdbUrl(routeMatch.descriptor, routeMatch.movieId, upstreamParams);
    const upstreamStartedAt = now();
    const effectiveUpstreamTimeoutMs = resolveEffectiveUpstreamTimeoutMs(
      requestUpstreamTimeoutMs,
      resolveRequestUpstreamTimeoutMs,
    );

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
