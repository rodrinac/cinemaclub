import type { AxiosRequestConfig } from "axios";
import api from "./index";
import {
  delay,
  disableTmdbRetry,
  getTmdbRetryDelayMs,
  MAX_RETRY_ATTEMPTS,
  shouldRetryTmdbRateLimitError,
} from "./retry";

const MIN_REQUEST_INTERVAL_MS = 200;

let queuedRequests = Promise.resolve();
let nextRequestAt = 0;

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
    const response = await api.get<T>(url, disableTmdbRetry(config));
    return response.data;
  } catch (error: any) {
    if (shouldRetryTmdbRateLimitError(error) && attempt < MAX_RETRY_ATTEMPTS) {
      await delay(getTmdbRetryDelayMs(error, attempt));
      return runQueuedRequest<T>(url, config, attempt + 1);
    }

    if (shouldRetryTmdbRateLimitError(error) && attempt >= MAX_RETRY_ATTEMPTS) {
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
