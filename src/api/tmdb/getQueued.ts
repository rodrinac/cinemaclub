import type { AxiosRequestConfig } from "axios";
import api from "./index";

const MIN_REQUEST_INTERVAL_MS = 200;
const DEFAULT_RETRY_AFTER_SECONDS = 1;
const MAX_RETRY_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 32000;

let queuedRequests = Promise.resolve();
let nextRequestAt = 0;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const jitter = (baseMs: number): number => {
  const variance = baseMs * 0.1;
  return baseMs + (Math.random() - 0.5) * 2 * variance;
};

const enqueue = <T>(request: () => Promise<T>): Promise<T> => {
  const run = async () => {
    const waitTime = Math.max(0, nextRequestAt - Date.now());

    if (waitTime > 0) {
      await delay(waitTime);
    }

    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;

    return request();
  };

  const queuedRequest = queuedRequests.then(run, run);
  queuedRequests = queuedRequest.then(
    () => undefined,
    () => undefined,
  );

  return queuedRequest;
};

const parseRetryAfterMs = (retryAfter: unknown): number => {
  const retryAfterSeconds = Number(retryAfter);

  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return DEFAULT_RETRY_AFTER_SECONDS * 1000;
  }

  return retryAfterSeconds * 1000;
};

export type RetryError = {
  message: string;
  attemptsExhausted: boolean;
  lastHttpStatus?: number;
  originalError?: Error;
};

const runQueuedRequest = async <T>(
  url: string,
  config?: AxiosRequestConfig,
  attempt: number = 1,
): Promise<T> => {
  try {
    const response = await api.get<T>(url, config);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429 && attempt < MAX_RETRY_ATTEMPTS) {
      const serverRetryAfter = parseRetryAfterMs(error.response.data?.parameters?.retry_after);
      const exponentialBackoff = Math.min(jitter(Math.pow(2, attempt - 1) * 1000), MAX_BACKOFF_MS);
      const delayMs = Math.max(serverRetryAfter, exponentialBackoff);

      await delay(delayMs);
      return runQueuedRequest<T>(url, config, attempt + 1);
    }

    if (error.response?.status === 429 && attempt >= MAX_RETRY_ATTEMPTS) {
      const retryError: RetryError = {
        message: `Request failed: rate limited after ${MAX_RETRY_ATTEMPTS} attempts`,
        attemptsExhausted: true,
        lastHttpStatus: 429,
        originalError: error,
      };
      throw retryError;
    }

    throw error;
  }
};

export const getQueued = <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return enqueue(() => runQueuedRequest<T>(url, config));
};
