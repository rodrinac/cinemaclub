import { createServer } from "node:http";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const port = Number.parseInt(process.env.PORT || "3001", 10);
const token = process.env.TMDB_API_TOKEN;

if (!token) {
  console.error("TMDB_API_TOKEN is required. Add it to .env before starting the API.");
  process.exit(1);
}

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
};

const tmdbRequest = async (path, params) => {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.search = params.toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.json();
  return { body, status: response.status };
};

const routes = {
  "/api/movies/now-playing": "/movie/now_playing",
  "/api/movies/popular": "/movie/popular",
  "/api/movies/upcoming": "/movie/upcoming",
  "/api/genres": "/genre/movie/list",
  "/api/search/movies": "/search/movie",
  "/api/movie/now_playing": "/movie/now_playing",
  "/api/movie/popular": "/movie/popular",
  "/api/movie/upcoming": "/movie/upcoming",
  "/api/genre/movie/list": "/genre/movie/list",
  "/api/search/movie": "/search/movie",
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

  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  const movieMatch = requestUrl.pathname.match(/^\/api\/(?:movies\/|movie\/)(\d+)$/);
  const tmdbPath = movieMatch ? `/movie/${movieMatch[1]}` : routes[requestUrl.pathname];
  if (!tmdbPath) {
    sendJson(response, 404, { error: "Route not found." });
    return;
  }

  try {
    const { body, status } = await tmdbRequest(tmdbPath, requestUrl.searchParams);
    sendJson(response, status, body);
  } catch {
    sendJson(response, 502, { error: "Unable to reach the movie service." });
  }
}).listen(port, () => {
  console.log(`Movies API listening on http://localhost:${port}`);
});
