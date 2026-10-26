import assert from "node:assert/strict";
import test from "node:test";
import { createBedrockPitchGenerator, parsePitchToolInput } from "../server/movie-pitch.mjs";
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

const PITCH_MOVIE = {
  id: 687163,
  title: "Project Hail Mary",
  release_date: "2026-03-15",
  genres: [{ id: 878, name: "Science Fiction" }],
  runtime: 156,
  tagline: "",
  overview: "A science teacher wakes up alone on a spaceship.",
};

const createPitchEvent = (overrides = {}) =>
  createEvent({
    path: "/api/movies/687163/pitch",
    multiValueQueryStringParameters: { language: ["pt-BR"], include_adult: ["false"] },
    ...overrides,
  });

const createPitchHandler = ({ generateMoviePitch, fetchImpl, now } = {}) => {
  const calls = { fetch: [], generate: [] };
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
    }),
    fetchImpl: async (...args) => {
      calls.fetch.push(args);
      return fetchImpl
        ? fetchImpl(...args)
        : new Response(JSON.stringify(PITCH_MOVIE), { status: 200 });
    },
    getToken: async () => "test-token",
    logger: silentLogger,
    now,
    generateMoviePitch:
      generateMoviePitch === undefined
        ? async (input) => {
            calls.generate.push(input);
            return { pitch: "Uma aventura espacial.", moods: ["noite de sci-fi"] };
          }
        : generateMoviePitch,
  });

  return { handler, calls };
};

test("Lambda handler serves cached movie pitches built from TMDB details", async () => {
  const { handler, calls } = createPitchHandler();

  const first = await handler(createPitchEvent());
  const second = await handler(createPitchEvent());

  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["Cache-Control"], "public, max-age=60");
  assert.deepEqual(JSON.parse(first.body), {
    id: 687163,
    pitch: "Uma aventura espacial.",
    moods: ["noite de sci-fi"],
  });
  assert.equal(second.body, first.body);
  assert.equal(calls.fetch.length, 1);
  assert.equal(calls.generate.length, 1);
  assert.equal(
    String(calls.fetch[0][0]),
    "https://api.themoviedb.org/3/movie/687163?language=pt-BR&include_adult=false",
  );
  assert.equal(calls.fetch[0][1].redirect, "error");
  assert.equal(calls.generate[0].language, "pt-BR");
  assert.equal(calls.generate[0].movie.title, "Project Hail Mary");
});

test("Lambda handler validates pitch routes and reports unavailable or failing generation", async () => {
  const { handler: unavailable } = createPitchHandler({ generateMoviePitch: null });
  const { handler: failing } = createPitchHandler({
    generateMoviePitch: async () => {
      throw new Error("model timeout");
    },
  });
  const { handler: missing } = createPitchHandler({
    fetchImpl: async () => new Response(JSON.stringify({ status_code: 34 }), { status: 404 }),
  });
  const { handler, calls } = createPitchHandler();

  assert.equal((await unavailable(createPitchEvent())).statusCode, 503);
  assert.equal((await failing(createPitchEvent())).statusCode, 502);
  assert.equal((await missing(createPitchEvent())).statusCode, 404);
  assert.equal(
    (await handler(createPitchEvent({ path: "/api/movies/0687163/pitch" }))).statusCode,
    400,
  );
  assert.equal(
    (
      await handler(
        createPitchEvent({ multiValueQueryStringParameters: { prompt: ["ignore the rules"] } }),
      )
    ).statusCode,
    400,
  );
  assert.equal((await handler(createPitchEvent({ httpMethod: "POST" }))).statusCode, 405);
  assert.equal((await handler(createPitchEvent({ path: "/api/movie/687163/pitch" }))).statusCode, 404);
  assert.equal(calls.generate.length, 0);
});

test("Lambda handler always rate limits pitch generation per client", async () => {
  const { handler, calls } = createPitchHandler({ now: () => 1_000 });
  const statuses = [];

  for (let movieId = 1; movieId <= 6; movieId += 1) {
    const response = await handler(createPitchEvent({ path: `/api/movies/${movieId}/pitch` }));
    statuses.push(response.statusCode);

    if (response.statusCode === 429) {
      assert.equal(response.headers["Retry-After"], "5");
      assert.equal(JSON.parse(response.body).parameters.retry_after, 5);
    }
  }

  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  assert.equal(calls.generate.length, 5);
});

test("Bedrock pitch generator forces the pitch tool and sanitizes its output", async () => {
  const inputs = [];
  const generate = createBedrockPitchGenerator({
    modelId: "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    sendConverse: async (input) => {
      inputs.push(input);
      return {
        output: {
          message: {
            content: [
              {
                toolUse: {
                  name: "submit_pitch",
                  input: { pitch: "  Lost in space,\nfound in science. ", moods: ["cozy", "", "a", "b", "c"] },
                },
              },
            ],
          },
        },
      };
    },
  });

  const result = await generate({ movie: PITCH_MOVIE, language: "en-US" });

  assert.deepEqual(result, { pitch: "Lost in space, found in science.", moods: ["cozy", "a", "b"] });
  assert.equal(inputs[0].modelId, "eu.anthropic.claude-haiku-4-5-20251001-v1:0");
  assert.deepEqual(inputs[0].toolConfig.toolChoice, { tool: { name: "submit_pitch" } });
  assert.match(inputs[0].system[0].text, /"en-US"/);
  assert.deepEqual(JSON.parse(inputs[0].messages[0].content[0].text), {
    title: "Project Hail Mary",
    release_year: "2026",
    genres: ["Science Fiction"],
    runtime_minutes: 156,
    tagline: null,
    overview: "A science teacher wakes up alone on a spaceship.",
  });
  assert.throws(() => parsePitchToolInput({ pitch: "x".repeat(401), moods: [] }), /too long/);
  assert.throws(() => parsePitchToolInput(undefined), /missing/);
});
