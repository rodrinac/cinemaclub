import assert from "node:assert/strict";
import test from "node:test";
import { createLambdaHandler, resolveApiGatewayClientKey } from "../server/tmdb-lambda.mjs";

const createEvent = (overrides = {}) => ({
  httpMethod: "GET",
  path: "/api/movies/popular",
  headers: {},
  multiValueQueryStringParameters: {
    page: ["1"],
    language: ["en-US"],
  },
  requestContext: {
    identity: {
      sourceIp: "203.0.113.10",
    },
    requestId: "request-1",
  },
  ...overrides,
});

const createEnv = (overrides = {}) => ({
  NODE_ENV: "test",
  ...overrides,
});

const silentLogger = {
  log() {},
  error() {},
};

test("Lambda handler serves canonical routes, aliases, and caches successful responses", async () => {
  const calls = [];
  const logs = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ results: [{ id: 42 }] }), { status: 200 });
  };
  let tokenLoads = 0;
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
    }),
    fetchImpl,
    getToken: async () => {
      tokenLoads += 1;
      return "test-token";
    },
    logger: {
      log(entry) {
        logs.push(JSON.parse(entry));
      },
      error(entry) {
        logs.push(JSON.parse(entry));
      },
    },
  });

  const firstResponse = await handler(createEvent());
  const secondResponse = await handler(
    createEvent({
      path: "/api/movie/popular",
      requestContext: {
        identity: { sourceIp: "203.0.113.10" },
        requestId: "request-2",
      },
    }),
  );

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(tokenLoads, 1);
  assert.equal(
    String(calls[0][0]),
    "https://api.themoviedb.org/3/movie/popular?page=1&language=en-US",
  );
  assert.deepEqual(calls[0][1].headers, {
    Accept: "application/json",
    Authorization: "Bearer test-token",
  });
  assert.equal(firstResponse.headers["Cache-Control"], "public, max-age=60");
  assert.equal(secondResponse.headers["Cache-Control"], "public, max-age=60");
  assert.equal(logs.some((entry) => entry.cache === "hit"), true);
});

test("Lambda handler enables exact-origin CORS only when configured", async () => {
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
      CORS_ALLOW_ORIGIN: "https://cinemaclub.example",
    }),
    fetchImpl: async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    getToken: async () => "test-token",
    logger: silentLogger,
  });

  const getResponse = await handler(
    createEvent({
      path: "/health",
      requestContext: {
        identity: { sourceIp: "203.0.113.10" },
        requestId: "request-3",
      },
    }),
  );
  const preflightResponse = await handler(
    createEvent({
      httpMethod: "OPTIONS",
      requestContext: {
        identity: { sourceIp: "203.0.113.10" },
        requestId: "request-4",
      },
    }),
  );

  assert.equal(getResponse.headers["Access-Control-Allow-Origin"], "https://cinemaclub.example");
  assert.equal(getResponse.headers.Vary, "Origin");
  assert.equal(preflightResponse.statusCode, 204);
  assert.equal(
    preflightResponse.headers["Access-Control-Allow-Origin"],
    "https://cinemaclub.example",
  );
  assert.equal(preflightResponse.headers["Access-Control-Allow-Methods"], "GET, OPTIONS");
  assert.equal(preflightResponse.headers["Access-Control-Allow-Headers"], "Content-Type");
});

test("Lambda handler rejects invalid params without CORS when disabled", async () => {
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
    }),
    fetchImpl: async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    getToken: async () => "test-token",
    logger: silentLogger,
  });

  const response = await handler(
    createEvent({
      multiValueQueryStringParameters: {
        unknown: ["1"],
      },
      requestContext: {
        identity: { sourceIp: "203.0.113.10" },
        requestId: "request-5",
      },
    }),
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
  assert.match(JSON.parse(response.body).error, /Unknown parameter/);
});

test("Lambda handler returns 429 with matching header and body while keeping health available", async () => {
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
      RATE_LIMIT_RPS: "5",
      RATE_LIMIT_BURST: "2",
    }),
    fetchImpl: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
    getToken: async () => "test-token",
    logger: silentLogger,
  });

  const first = await handler(
    createEvent({
      requestContext: { identity: { sourceIp: "203.0.113.10" }, requestId: "request-6" },
    }),
  );
  const second = await handler(
    createEvent({
      multiValueQueryStringParameters: { page: ["2"], language: ["en-US"] },
      requestContext: { identity: { sourceIp: "203.0.113.10" }, requestId: "request-7" },
    }),
  );
  const third = await handler(
    createEvent({
      multiValueQueryStringParameters: { page: ["3"], language: ["en-US"] },
      requestContext: { identity: { sourceIp: "203.0.113.10" }, requestId: "request-8" },
    }),
  );
  const health = await handler(
    createEvent({
      path: "/health",
      multiValueQueryStringParameters: null,
      requestContext: { identity: { sourceIp: "203.0.113.10" }, requestId: "request-9" },
    }),
  );

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.equal(third.headers["Retry-After"], "1");
  assert.deepEqual(JSON.parse(third.body), {
    error: "Too many requests. Please retry shortly.",
    parameters: {
      retry_after: 1,
    },
  });
  assert.equal(health.statusCode, 200);
});

test("Lambda handler applies CACHE_MAX_ENTRIES to cache eviction", async () => {
  const upstreamRequests = [];
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
      CACHE_MAX_ENTRIES: "2",
    }),
    fetchImpl: async (url) => {
      upstreamRequests.push(String(url));
      return new Response(JSON.stringify({ page: new URL(url).searchParams.get("page") }), {
        status: 200,
      });
    },
    getToken: async () => "test-token",
    logger: silentLogger,
  });

  const requestPage = async (page, requestId) =>
    handler(
      createEvent({
        multiValueQueryStringParameters: {
          page: [String(page)],
          language: ["en-US"],
        },
        requestContext: {
          identity: { sourceIp: "203.0.113.10" },
          requestId,
        },
      }),
    );

  await requestPage(1, "request-11");
  await requestPage(2, "request-12");
  await requestPage(3, "request-13");
  await requestPage(1, "request-14");

  assert.equal(upstreamRequests.length, 4);
  assert.deepEqual(upstreamRequests, [
    "https://api.themoviedb.org/3/movie/popular?page=1&language=en-US",
    "https://api.themoviedb.org/3/movie/popular?page=2&language=en-US",
    "https://api.themoviedb.org/3/movie/popular?page=3&language=en-US",
    "https://api.themoviedb.org/3/movie/popular?page=1&language=en-US",
  ]);
});

test("Lambda handler rejects invalid CACHE_MAX_ENTRIES during startup", () => {
  assert.throws(
    () =>
      createLambdaHandler({
        env: createEnv({
          TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
          CACHE_MAX_ENTRIES: "1.5",
        }),
        getToken: async () => "test-token",
        logger: silentLogger,
      }),
    /CACHE_MAX_ENTRIES must be a positive safe integer/,
  );
});

test("Lambda handler returns 502 on upstream timeout without leaking the token", async () => {
  const timeoutError = new Error("timed out");
  timeoutError.name = "TimeoutError";

  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
    }),
    fetchImpl: async () => {
      throw timeoutError;
    },
    getToken: async () => "super-secret-token",
    logger: silentLogger,
  });

  const response = await handler(
    createEvent({
      requestContext: { identity: { sourceIp: "203.0.113.10" }, requestId: "request-10" },
    }),
  );

  assert.equal(response.statusCode, 502);
  assert.equal(response.body, JSON.stringify({ error: "Unable to reach the movie service." }));
  assert.equal(response.body.includes("super-secret-token"), false);
});

test("Lambda handler resolves upstream timeout after token lookup using remaining invocation time", async (t) => {
  const timeoutValues = [];
  let remainingTimeMs = 10_000;
  t.mock.method(AbortSignal, "timeout", (timeoutMs) => {
    timeoutValues.push(timeoutMs);
    return new AbortController().signal;
  });

  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
    }),
    fetchImpl: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
    getToken: async () => {
      remainingTimeMs = 6_500;
      return "test-token";
    },
    logger: silentLogger,
  });

  const response = await handler(createEvent(), {
    awsRequestId: "aws-request-1",
    getRemainingTimeInMillis: () => remainingTimeMs,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(timeoutValues, [4_500]);
});

test("resolveApiGatewayClientKey only trusts forwarded-for chains that include the gateway source IP", () => {
  assert.equal(
    resolveApiGatewayClientKey(
      createEvent({
        headers: {
          "x-forwarded-for": "198.51.100.7, 203.0.113.10",
        },
      }),
    ),
    "198.51.100.7",
  );

  assert.equal(
    resolveApiGatewayClientKey(
      createEvent({
        headers: {
          "x-forwarded-for": "198.51.100.7",
        },
      }),
    ),
    "203.0.113.10",
  );
});
