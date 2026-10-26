import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPitchMovieFacts,
  createBedrockPitchGenerator,
  parsePitchToolInput,
} from "../server/movie-pitch.mjs";
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
    "https://api.themoviedb.org/3/movie/687163?language=pt-BR&include_adult=false&append_to_response=keywords%2Ccredits%2Crelease_dates",
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
  // Haiku otherwise pulls in outside knowledge such as "from the directors of The Lego Movie".
  assert.match(inputs[0].system[0].text, /never add anything you know about the movie or its people from elsewhere/);
  assert.match(inputs[0].system[0].text, /Never name other movies, shows, or works/);
  assert.match(inputs[0].system[0].text, /never "from the directors of" another title/);
  assert.deepEqual(JSON.parse(inputs[0].messages[0].content[0].text), {
    title: "Project Hail Mary",
    release_year: "2026",
    genres: ["Science Fiction"],
    runtime_minutes: 156,
    tagline: null,
    keywords: [],
    directors: [],
    writers: [],
    top_cast: [],
    audience_rating: null,
    certification: null,
  });
  assert.throws(() => parsePitchToolInput({ pitch: "x".repeat(401), moods: [] }), /too long/);
  assert.throws(() => parsePitchToolInput(undefined), /missing/);
});

test("Pitch facts carry keywords, credits, rating and the language's certification", () => {
  const facts = buildPitchMovieFacts(
    {
      ...PITCH_MOVIE,
      vote_average: 8.634,
      vote_count: 8535,
      keywords: { keywords: [{ name: "interspecies friendship" }, { name: "language barrier" }] },
      credits: {
        cast: [
          { name: "Ryan Gosling", character: "Ryland Grace" },
          { name: "Sandra Hüller", character: "Eva Stratt" },
          { name: "James Ortiz", character: "Rocky (voice)" },
          { name: "Lionel Boyce", character: "Carl" },
        ],
        crew: [
          { name: "Phil Lord", job: "Director" },
          { name: "Christopher Miller", job: "Director" },
          { name: "Andy Weir", job: "Novel" },
          { name: "Drew Goddard", job: "Screenplay" },
          { name: "Greig Fraser", job: "Director of Photography" },
        ],
      },
      release_dates: {
        results: [
          { iso_3166_1: "US", release_dates: [{ certification: "" }, { certification: "PG-13" }] },
          { iso_3166_1: "BR", release_dates: [{ certification: "12" }] },
        ],
      },
    },
    "pt-BR",
  );

  assert.deepEqual(facts.keywords, ["interspecies friendship", "language barrier"]);
  assert.deepEqual(facts.directors, ["Phil Lord", "Christopher Miller"]);
  assert.deepEqual(facts.writers, ["Andy Weir (Novel)", "Drew Goddard (Screenplay)"]);
  assert.deepEqual(facts.top_cast, [
    "Ryan Gosling as Ryland Grace",
    "Sandra Hüller as Eva Stratt",
    "James Ortiz as Rocky (voice)",
  ]);
  assert.deepEqual(facts.audience_rating, { average_out_of_10: 8.6, votes: 8535 });
  assert.equal(facts.certification, "12");
  assert.equal(buildPitchMovieFacts({ ...PITCH_MOVIE, release_dates: { results: [{ iso_3166_1: "US", release_dates: [{ certification: "PG-13" }] }] } }, "fr").certification, "PG-13");
  assert.equal(buildPitchMovieFacts({ ...PITCH_MOVIE, vote_average: 9, vote_count: 3 }, "en-US").audience_rating, null);
});

test("Lambda handler builds discover-backed Upcoming and Top Rated lists with server-fixed filters", async () => {
  const calls = [];
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
    }),
    fetchImpl: async (url) => {
      calls.push(new URL(String(url)));
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    },
    getToken: async () => "test-token",
    now: () => Date.parse("2026-10-26T12:00:00Z"),
    logger: silentLogger,
  });

  const responses = await Promise.all([
    handler(createEvent({ path: "/api/movies/upcoming" })),
    handler(
      createEvent({
        path: "/api/movies/upcoming",
        multiValueQueryStringParameters: { page: ["1"], language: ["pt-BR"], region: ["BR"] },
      }),
    ),
    handler(createEvent({ path: "/api/movies/top-rated" })),
    handler(
      createEvent({
        path: "/api/movies/now-playing",
        multiValueQueryStringParameters: { page: ["1"], region: ["US"] },
      }),
    ),
  ]);

  assert.deepEqual(
    responses.map((response) => response.statusCode),
    [200, 200, 200, 200],
  );

  const [globalUpcoming, regionalUpcoming, topRated, nowPlaying] = calls;
  assert.equal(globalUpcoming.pathname, "/3/discover/movie");
  assert.equal(globalUpcoming.searchParams.get("primary_release_date.gte"), "2026-10-27");
  assert.equal(globalUpcoming.searchParams.get("sort_by"), "popularity.desc");
  assert.equal(globalUpcoming.searchParams.has("release_date.gte"), false);

  assert.equal(regionalUpcoming.searchParams.get("region"), "BR");
  assert.equal(regionalUpcoming.searchParams.get("release_date.gte"), "2026-10-27");
  assert.equal(regionalUpcoming.searchParams.get("with_release_type"), "2|3");
  assert.equal(regionalUpcoming.searchParams.get("primary_release_date.gte"), "2025-10-26");

  assert.equal(topRated.pathname, "/3/discover/movie");
  assert.equal(topRated.searchParams.get("sort_by"), "vote_average.desc");
  assert.equal(topRated.searchParams.get("vote_count.gte"), "5000");

  assert.equal(String(nowPlaying), "https://api.themoviedb.org/3/movie/now_playing?page=1&region=US");
});

test("Lambda handler only accepts region on release-based lists and validates its format", async () => {
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
    }),
    fetchImpl: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
    getToken: async () => "test-token",
    logger: silentLogger,
  });

  const statusFor = async (path, region) =>
    (
      await handler(
        createEvent({ path, multiValueQueryStringParameters: { page: ["1"], region: [region] } }),
      )
    ).statusCode;

  assert.equal(await statusFor("/api/movies/now-playing", "br"), 400);
  assert.equal(await statusFor("/api/movies/upcoming", "BRA"), 400);
  assert.equal(await statusFor("/api/movies/top-rated", "BR"), 400);
  assert.equal(await statusFor("/api/movies/popular", "BR"), 400);
  assert.equal(
    (
      await handler(
        createEvent({
          path: "/api/movies/upcoming",
          multiValueQueryStringParameters: { sort_by: ["revenue.desc"] },
        }),
      )
    ).statusCode,
    400,
  );
});

const SHARE_MOVIE = {
  id: 687163,
  title: 'Devoradores de "Estrelas" <script>alert(1)</script>',
  release_date: "2026-03-15",
  overview: `${"Um professor acorda numa nave. ".repeat(10)}Fim.`,
  backdrop_path: "/backdrop123.jpg",
  poster_path: "/poster123.jpg",
};

const createShareEvent = (overrides = {}) =>
  createEvent({
    path: "/share/movie/687163",
    multiValueQueryStringParameters: { lang: ["pt-BR"] },
    ...overrides,
  });

const createShareHandler = ({ env = {}, fetchImpl } = {}) => {
  const calls = [];
  const handler = createLambdaHandler({
    env: createEnv({
      TMDB_SECRET_ARN: "arn:aws:secretsmanager:region:account:secret:example",
      CORS_ALLOW_ORIGIN: "https://cinemaclub.expo.app",
      ...env,
    }),
    fetchImpl: async (...args) => {
      calls.push(args);
      return fetchImpl ? fetchImpl(...args) : new Response(JSON.stringify(SHARE_MOVIE), { status: 200 });
    },
    getToken: async () => "test-token",
    logger: silentLogger,
  });

  return { handler, calls };
};

test("Lambda handler renders escaped, localized movie share pages that redirect to the web app", async () => {
  const { handler, calls } = createShareHandler();

  const first = await handler(createShareEvent());
  const second = await handler(createShareEvent());

  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(first.headers["Cache-Control"], "public, max-age=60");
  assert.match(first.headers["Content-Security-Policy"], /default-src 'none'/);
  assert.equal(second.body, first.body);
  assert.equal(calls.length, 1);
  assert.equal(String(calls[0][0]), "https://api.themoviedb.org/3/movie/687163?language=pt-BR");
  assert.equal(calls[0][1].redirect, "error");

  const html = first.body;
  assert.ok(!html.includes("<script>"));
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(
    html,
    /<meta property="og:title" content="Devoradores de &quot;Estrelas&quot; &lt;script&gt;alert\(1\)&lt;\/script&gt; \(2026\) • Cinema Club">/,
  );
  assert.match(html, /<meta property="og:image" content="https:\/\/image\.tmdb\.org\/t\/p\/w1280\/backdrop123\.jpg">/);
  assert.match(html, /<meta property="og:locale" content="pt_BR">/);
  assert.match(html, /<meta property="og:type" content="video\.movie">/);
  assert.match(html, /<meta http-equiv="refresh" content="0;url=https:\/\/cinemaclub\.expo\.app\/movie\/687163">/);
  const description = html.match(/<meta name="description" content="([^"]*)">/)[1];
  assert.ok(description.length <= 200);
  assert.ok(description.endsWith("…"));
});

test("Lambda handler share pages fall back to generic redirects and validate input", async () => {
  const { handler: missing } = createShareHandler({
    fetchImpl: async () => new Response("{}", { status: 404 }),
  });
  const { handler: failing } = createShareHandler({
    fetchImpl: async () => new Response("{}", { status: 500 }),
  });
  const { handler: disabled } = createShareHandler({ env: { CORS_ALLOW_ORIGIN: undefined } });
  const { handler: overridden, calls } = createShareHandler({
    env: { SHARE_APP_ORIGIN: "http://localhost:8081" },
  });

  const notFound = await missing(createShareEvent());
  assert.equal(notFound.statusCode, 404);
  assert.match(notFound.body, /content="0;url=https:\/\/cinemaclub\.expo\.app\/"/);
  assert.match(notFound.body, /<meta property="og:title" content="Cinema Club">/);

  const upstreamFailure = await failing(createShareEvent());
  assert.equal(upstreamFailure.statusCode, 502);
  assert.match(upstreamFailure.body, /content="0;url=https:\/\/cinemaclub\.expo\.app\/movie\/687163"/);

  assert.equal((await disabled(createShareEvent())).statusCode, 503);

  const local = await overridden(createShareEvent({ multiValueQueryStringParameters: {} }));
  assert.match(local.body, /content="0;url=http:\/\/localhost:8081\/movie\/687163"/);
  assert.match(local.body, /<html lang="en-US">/);
  assert.equal(String(calls[0][0]), "https://api.themoviedb.org/3/movie/687163");

  for (const multiValueQueryStringParameters of [
    { language: ["pt-BR"] },
    { lang: ["pt BR"] },
    { lang: ["pt-BR", "en-US"] },
  ]) {
    assert.equal(
      (await overridden(createShareEvent({ multiValueQueryStringParameters }))).statusCode,
      400,
    );
  }
  assert.equal((await overridden(createShareEvent({ path: "/share/movie/0687163" }))).statusCode, 400);
  assert.equal((await overridden(createShareEvent({ httpMethod: "POST" }))).statusCode, 405);
  assert.throws(
    () => createLambdaHandler({ env: createEnv({ SHARE_APP_ORIGIN: "https://cinemaclub.expo.app/app" }) }),
    /without a path/,
  );

  // The live e2e suite runs the API with a 127.0.0.1 CORS origin and no SHARE_APP_ORIGIN.
  const { handler: loopback } = createShareHandler({ env: { CORS_ALLOW_ORIGIN: "http://127.0.0.1:8081" } });
  assert.match((await loopback(createShareEvent())).body, /content="0;url=http:\/\/127\.0\.0\.1:8081\/movie\/687163"/);

  // A CORS origin share pages cannot use disables them instead of failing startup.
  const { handler: unusable } = createShareHandler({ env: { CORS_ALLOW_ORIGIN: "http://example.com" } });
  assert.equal((await unusable(createShareEvent())).statusCode, 503);
});
