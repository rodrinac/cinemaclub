import type { AxiosRequestConfig } from "axios";
import api from "./index";

const MIN_REQUEST_INTERVAL_MS = 200;
const DEFAULT_RETRY_AFTER_SECONDS = 1;

let queuedRequests = Promise.resolve();
let nextRequestAt = 0;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

const runQueuedRequest = async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  try {
    const response = await api.get<T>(url, config);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      await delay(parseRetryAfterMs(error.response.data?.parameters?.retry_after));
      return runQueuedRequest<T>(url, config);
    }

    throw error;
  }
};

export const getQueued = <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return enqueue(() => runQueuedRequest<T>(url, config));
};
