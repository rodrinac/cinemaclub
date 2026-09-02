import type { AxiosInstance, AxiosRequestConfig } from "axios";

const DEFAULT_RETRY_AFTER_SECONDS = 1;
export const MAX_RETRY_ATTEMPTS = 3;
export const MAX_BACKOFF_MS = 32000;

const RETRY_ATTEMPT_KEY = "__tmdbRetryAttempt";
const RETRY_DISABLED_KEY = "__tmdbRetryDisabled";

type TmdbRetryConfig = AxiosRequestConfig & {
  [RETRY_ATTEMPT_KEY]?: number;
  [RETRY_DISABLED_KEY]?: boolean;
};

const jitter = (baseMs: number): number => {
  const variance = baseMs * 0.1;
  return baseMs + (Math.random() - 0.5) * 2 * variance;
};

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const readRetryAfterHeader = (headers: unknown): unknown => {
  if (!headers) {
    return undefined;
  }

  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get("retry-after");
  }

  const record = headers as Record<string, unknown>;
  return record["retry-after"] ?? record["Retry-After"];
};

export const parseRetryAfterMs = (retryAfter: unknown): number => {
  if (Array.isArray(retryAfter)) {
    return parseRetryAfterMs(retryAfter[0]);
  }

  if (typeof retryAfter === "string") {
    const trimmedRetryAfter = retryAfter.trim();
    const parsedSeconds = Number(trimmedRetryAfter);

    if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
      return parsedSeconds * 1000;
    }

    const parsedDate = Date.parse(trimmedRetryAfter);
    if (Number.isFinite(parsedDate)) {
      return Math.max(DEFAULT_RETRY_AFTER_SECONDS * 1000, parsedDate - Date.now());
    }
  }

  const parsedSeconds = Number(retryAfter);
  if (!Number.isFinite(parsedSeconds) || parsedSeconds <= 0) {
    return DEFAULT_RETRY_AFTER_SECONDS * 1000;
  }

  return parsedSeconds * 1000;
};

export const shouldRetryTmdbRateLimitError = (error: any): boolean => {
  return error?.response?.status === 429;
};

export const getTmdbRetryDelayMs = (error: any, attempt: number): number => {
  const serverRetryAfterMs = parseRetryAfterMs(
    readRetryAfterHeader(error?.response?.headers) ?? error?.response?.data?.parameters?.retry_after,
  );
  const exponentialBackoffMs = Math.min(jitter(Math.pow(2, attempt - 1) * 1000), MAX_BACKOFF_MS);

  return Math.max(serverRetryAfterMs, exponentialBackoffMs);
};

export const getTmdbRetryAttempt = (config?: AxiosRequestConfig): number => {
  return ((config as TmdbRetryConfig | undefined)?.[RETRY_ATTEMPT_KEY] ?? 1) as number;
};

export const setTmdbRetryAttempt = (
  config: AxiosRequestConfig = {},
  attempt: number,
): AxiosRequestConfig => {
  const nextConfig: TmdbRetryConfig = {
    ...config,
    [RETRY_ATTEMPT_KEY]: attempt,
  };

  return nextConfig;
};

export const isTmdbRetryDisabled = (config?: AxiosRequestConfig): boolean => {
  return Boolean((config as TmdbRetryConfig | undefined)?.[RETRY_DISABLED_KEY]);
};

export const disableTmdbRetry = (config?: AxiosRequestConfig): AxiosRequestConfig => {
  const nextConfig: TmdbRetryConfig = {
    ...(config ?? {}),
    [RETRY_DISABLED_KEY]: true,
  };

  return nextConfig;
};

export const installTmdbRateLimitRetryInterceptor = (api: AxiosInstance): void => {
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (!shouldRetryTmdbRateLimitError(error) || isTmdbRetryDisabled(error.config)) {
        throw error;
      }

      const attempt = getTmdbRetryAttempt(error.config);
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        throw error;
      }

      await delay(getTmdbRetryDelayMs(error, attempt));
      return api.request(setTmdbRetryAttempt(error.config, attempt + 1));
    },
  );
};
