import { createServer } from "node:http";
import { createResponseCache, createTmdbProxy, parseCorsAllowOrigin, parseRateLimitConfig } from "./tmdb-proxy-core.mjs";

const port = Number.parseInt(process.env.PORT || "3001", 10);
const token = process.env.TMDB_API_TOKEN?.trim();

if (!token) {
  console.error("TMDB_API_TOKEN is required. Add it to .env before starting the API.");
  process.exit(1);
}

let corsAllowOrigin;
let rateLimitConfig;

try {
  corsAllowOrigin = parseCorsAllowOrigin(process.env.CORS_ALLOW_ORIGIN);
  rateLimitConfig = parseRateLimitConfig({
    rateLimitRps: process.env.RATE_LIMIT_RPS,
    rateLimitBurst: process.env.RATE_LIMIT_BURST,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid TMDB proxy configuration.");
  process.exit(1);
}

const proxy = createTmdbProxy({
  getToken: async () => token,
  cache: createResponseCache(),
  corsAllowOrigin,
  rateLimitConfig,
  log: console,
});

let nextRequestId = 1;

createServer(async (request, response) => {
  if (!request.url || !request.url.startsWith("/")) {
    response.writeHead(400, {
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({ error: "Invalid request URL." }));
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url, "http://localhost");
  } catch {
    response.writeHead(400, {
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify({ error: "Invalid request URL." }));
    return;
  }

  const rawPathname = request.url.split("?")[0].split("#")[0];
  const result = await proxy({
    method: request.method || "GET",
    pathname: requestUrl.pathname,
    rawPathname,
    searchParams: requestUrl.searchParams,
    headers: request.headers,
    requestId: `local-${nextRequestId}`,
    clientKey: request.socket.remoteAddress || "unknown",
  });
  nextRequestId += 1;

  response.writeHead(result.statusCode, result.headers);
  response.end(result.body);
}).listen(port, () => {
  console.log(`Movies API listening on http://localhost:${port}`);
});
