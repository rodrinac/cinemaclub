import {
  createResponseCache,
  createTmdbProxy,
  DEFAULT_CACHE_MAX_ENTRIES,
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  parseCorsAllowOrigin,
  parseRateLimitConfig,
} from "./tmdb-proxy-core.mjs";

const LAMBDA_UPSTREAM_TIMEOUT_MARGIN_MS = 2_000;

const readHeader = (headers = {}, name) => {
  const lowerName = name.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
};

const buildSearchParams = (event) => {
  const searchParams = new URLSearchParams();
  const multiValueParams = event?.multiValueQueryStringParameters;

  if (multiValueParams && Object.keys(multiValueParams).length > 0) {
    for (const [key, values] of Object.entries(multiValueParams)) {
      for (const value of values ?? []) {
        searchParams.append(key, value ?? "");
      }
    }

    return searchParams;
  }

  const singleValueParams = event?.queryStringParameters;
  if (!singleValueParams) {
    return searchParams;
  }

  for (const [key, value] of Object.entries(singleValueParams)) {
    searchParams.append(key, value ?? "");
  }

  return searchParams;
};

const readRequiredEnv = (env, name) => {
  const value = env?.[name];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
};

const parseCacheMaxEntries = (value) => {
  if (value == null) {
    return DEFAULT_CACHE_MAX_ENTRIES;
  }

  if (typeof value === "string" && value.trim() === "") {
    throw new Error("CACHE_MAX_ENTRIES cannot be blank.");
  }

  const parsedValue = typeof value === "number" ? value : Number(value);

  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < 1
  ) {
    throw new Error("CACHE_MAX_ENTRIES must be a positive safe integer.");
  }

  return parsedValue;
};

const resolveUpstreamTimeoutMs = (context) => {
  if (typeof context?.getRemainingTimeInMillis !== "function") {
    return DEFAULT_UPSTREAM_TIMEOUT_MS;
  }

  const remainingTimeMs = context.getRemainingTimeInMillis();

  if (!Number.isFinite(remainingTimeMs) || remainingTimeMs <= 0) {
    return DEFAULT_UPSTREAM_TIMEOUT_MS;
  }

  return Math.max(
    1,
    Math.min(DEFAULT_UPSTREAM_TIMEOUT_MS, Math.floor(remainingTimeMs) - LAMBDA_UPSTREAM_TIMEOUT_MARGIN_MS),
  );
};

const createSecretsManagerTokenProvider = ({ env = process.env } = {}) => {
  const secretArn = readRequiredEnv(env, "TMDB_SECRET_ARN");

  let cachedToken;
  let inflightRequest;

  return async () => {
    if (cachedToken) {
      return cachedToken;
    }

    if (inflightRequest) {
      return inflightRequest;
    }

    inflightRequest = (async () => {
      const { GetSecretValueCommand, SecretsManagerClient } = await import(
        "@aws-sdk/client-secrets-manager"
      );

      const client = new SecretsManagerClient({
        region: env.AWS_REGION || env.AWS_DEFAULT_REGION,
      });
      const response = await client.send(
        new GetSecretValueCommand({
          SecretId: secretArn,
        }),
      );
      const token = response.SecretString?.trim();

      if (!token) {
        throw new Error("Secrets Manager secret did not contain a usable TMDB token.");
      }

      cachedToken = token;
      return token;
    })().catch((error) => {
      inflightRequest = undefined;
      throw error;
    });

    const token = await inflightRequest;
    inflightRequest = undefined;
    return token;
  };
};

const createLogger = (baseLogger, requestId) => ({
  info(payload) {
    if (typeof baseLogger?.log === "function") {
      baseLogger.log(JSON.stringify({ requestId, ...payload }));
    }
  },
  error(payload) {
    if (typeof baseLogger?.error === "function") {
      baseLogger.error(JSON.stringify({ requestId, ...payload }));
      return;
    }

    if (typeof baseLogger?.log === "function") {
      baseLogger.log(JSON.stringify({ level: "error", requestId, ...payload }));
    }
  },
});

export const resolveApiGatewayClientKey = (event) => {
  const sourceIp = event?.requestContext?.identity?.sourceIp?.trim() || "unknown";
  const forwardedForValue = readHeader(event?.headers, "x-forwarded-for");

  if (typeof forwardedForValue !== "string" || !forwardedForValue.trim()) {
    return sourceIp;
  }

  const parts = forwardedForValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1 && parts.at(-1) === sourceIp) {
    return parts[0];
  }

  return sourceIp;
};

export const createLambdaHandler = ({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  logger = console,
  cache,
  getToken,
} = {}) => {
  const corsAllowOrigin = parseCorsAllowOrigin(env.CORS_ALLOW_ORIGIN);
  const cacheMaxEntries = parseCacheMaxEntries(env.CACHE_MAX_ENTRIES);
  const rateLimitConfig = parseRateLimitConfig({
    rateLimitRps: env.RATE_LIMIT_RPS,
    rateLimitBurst: env.RATE_LIMIT_BURST,
  });
  const resolveToken = getToken ?? createSecretsManagerTokenProvider({ env });
  const resolvedCache = cache ?? createResponseCache({ maxEntries: cacheMaxEntries });

  const proxy = createTmdbProxy({
    getToken: resolveToken,
    fetchImpl,
    now,
    cache: resolvedCache,
    log: logger,
    corsAllowOrigin,
    rateLimitConfig,
  });

  return async (event = {}, context = {}) => {
    const pathname = typeof event.path === "string" ? event.path : "/";
    const requestId =
      event?.requestContext?.requestId || context?.awsRequestId || `lambda-${Date.now()}`;
    const requestLogger = createLogger(logger, requestId);

    try {
      return await proxy({
        method: event.httpMethod || "GET",
        pathname,
        rawPathname: pathname,
        searchParams: buildSearchParams(event),
        headers: event.headers ?? {},
        requestId,
        clientKey: resolveApiGatewayClientKey(event),
        resolveUpstreamTimeoutMs: () => resolveUpstreamTimeoutMs(context),
      });
    } catch (error) {
      requestLogger.error({
        kind: "tmdb_proxy_error",
        route: pathname,
        reason: "handler_failure",
        message: error instanceof Error ? error.message : "Unhandled Lambda failure",
      });

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ error: "Internal server error." }),
      };
    }
  };
};

let cachedHandler;
let cachedHandlerSignature;

const buildHandlerSignature = (env) => {
  return JSON.stringify({
    corsAllowOrigin: env.CORS_ALLOW_ORIGIN ?? null,
    rateLimitRps: env.RATE_LIMIT_RPS ?? null,
    rateLimitBurst: env.RATE_LIMIT_BURST ?? null,
    cacheMaxEntries: env.CACHE_MAX_ENTRIES ?? null,
    tmdbSecretArn: env.TMDB_SECRET_ARN ?? null,
  });
};

export const handler = async (event, context) => {
  const nextSignature = buildHandlerSignature(process.env);

  if (!cachedHandler || cachedHandlerSignature !== nextSignature) {
    cachedHandler = createLambdaHandler();
    cachedHandlerSignature = nextSignature;
  }

  return cachedHandler(event, context);
};
