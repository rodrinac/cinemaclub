import { createServer } from "node:http";

const TMDB_BASE_URL = new URL("https://api.themoviedb.org/3/");
const TMDB_ORIGIN = "https://api.themoviedb.org";
const TMDB_API_PATH_PREFIX = "/3/";

const port = Number.parseInt(process.env.PORT || "3001", 10);
const token = process.env.TMDB_API_TOKEN;

if (!token) {
  console.error("TMDB_API_TOKEN is required. Add it to .env before starting the API.");
  process.exit(1);
}

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
});

const routes = Object.freeze({
  "/api/movies/now-playing": Object.freeze({ endpoint: ENDPOINTS.NOW_PLAYING, policy: "paged" }),
  "/api/movies/popular": Object.freeze({ endpoint: ENDPOINTS.POPULAR, policy: "paged" }),
  "/api/movies/upcoming": Object.freeze({ endpoint: ENDPOINTS.UPCOMING, policy: "paged" }),
  "/api/genres": Object.freeze({ endpoint: ENDPOINTS.GENRES, policy: "common" }),
  "/api/search/movies": Object.freeze({ endpoint: ENDPOINTS.SEARCH, policy: "search" }),
  "/api/movie/now_playing": Object.freeze({ endpoint: ENDPOINTS.NOW_PLAYING, policy: "paged" }),
  "/api/movie/popular": Object.freeze({ endpoint: ENDPOINTS.POPULAR, policy: "paged" }),
  "/api/movie/upcoming": Object.freeze({ endpoint: ENDPOINTS.UPCOMING, policy: "paged" }),
  "/api/genre/movie/list": Object.freeze({ endpoint: ENDPOINTS.GENRES, policy: "common" }),
  "/api/search/movie": Object.freeze({ endpoint: ENDPOINTS.SEARCH, policy: "search" }),
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

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
};

const hasUnsafePathTraversal = (rawPathname) => {
  if (typeof rawPathname !== "string") return true;

  if (rawPathname.includes("\\") || rawPathname.includes("\0")) {
    return true;
  }

  let current = rawPathname;
  const maxDecodes = 3;

  for (let i = 0; i < maxDecodes; i++) {
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

  const finalSegments = current.split("/");
  for (const segment of finalSegments) {
    if (segment === "." || segment === "..") {
      return true;
    }
  }

  return false;
};

const parseMovieId = (pathname) => {
  const match = pathname.match(/^\/api\/(?:movies|movie)\/([0-9]+)$/);
  if (!match) return undefined;

  const idStr = match[1];
  const idNum = Number.parseInt(idStr, 10);
  if (!Number.isSafeInteger(idNum) || idNum < 0 || String(idNum) !== idStr) {
    return null;
  }
  return idNum;
};

const validateLanguage = (val) => {
  if (typeof val !== "string" || val.length < 2 || val.length > 35) return false;
  return /^[a-zA-Z0-9]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(val);
};

const validateIncludeAdult = (val) => {
  return val === "true" || val === "false";
};

const validatePage = (val) => {
  if (typeof val !== "string" || !/^[1-9][0-9]*$/.test(val)) return false;
  const num = Number.parseInt(val, 10);
  return num >= 1 && num <= 500 && String(num) === val;
};

const validateAppendToResponse = (val) => {
  if (typeof val !== "string" || val.length === 0) return false;
  const parts = val.split(",");
  const seen = new Set();
  for (const part of parts) {
    if (!ALLOWED_EXPANSIONS.has(part)) return false;
    if (seen.has(part)) return false;
    seen.add(part);
  }
  return true;
};

const validateQuery = (val) => {
  if (typeof val !== "string" || val.length < 1 || val.length > 500) return false;
  return !/[\x00-\x1F\x7F]/.test(val);
};

const validateQueryParams = (searchParams, policyName) => {
  const policy = POLICIES[policyName];
  if (!policy) {
    throw new Error(`Invalid policy: ${policyName}`);
  }

  const seenKeys = new Set();
  const safeParams = new URLSearchParams();

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

const tmdbRequest = async (descriptor, movieId, safeParams) => {
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

  const response = await fetch(url, {
    redirect: "error",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.json();
  return { body, status: response.status };
};

createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Only GET requests are supported." });
    return;
  }

  if (!request.url || !request.url.startsWith("/")) {
    sendJson(response, 400, { error: "Invalid request URL." });
    return;
  }

  const rawPathname = request.url.split("?")[0].split("#")[0];
  if (hasUnsafePathTraversal(rawPathname)) {
    sendJson(response, 400, { error: "Invalid path format." });
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url, "http://localhost");
  } catch {
    sendJson(response, 400, { error: "Invalid request URL." });
    return;
  }

  if (requestUrl.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  const movieId = parseMovieId(requestUrl.pathname);
  let routeDescriptor;

  if (movieId !== undefined) {
    if (movieId === null) {
      sendJson(response, 400, { error: "Invalid movie ID." });
      return;
    }
    routeDescriptor = MOVIE_DETAIL_DESCRIPTOR;
  } else {
    routeDescriptor = routes[requestUrl.pathname];
  }

  if (!routeDescriptor) {
    sendJson(response, 404, { error: "Route not found." });
    return;
  }

  let safeParams;
  try {
    safeParams = validateQueryParams(requestUrl.searchParams, routeDescriptor.policy);
  } catch (err) {
    sendJson(response, 400, { error: err.message || "Invalid query parameters." });
    return;
  }

  try {
    const { body, status } = await tmdbRequest(routeDescriptor, movieId, safeParams);
    sendJson(response, status, body);
  } catch {
    sendJson(response, 502, { error: "Unable to reach the movie service." });
  }
}).listen(port, () => {
  console.log(`Movies API listening on http://localhost:${port}`);
});
