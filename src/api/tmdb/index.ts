import axios, { AxiosRequestConfig } from "axios";
import conf from "./conf.json";
import SmartQueue from "smart-request-balancer";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";

const getLocale = () => getLocales()[0].languageTag;

const api = axios.create({
  baseURL: "https://api.themoviedb.org/3/",
  params: {
    language: getLocale(),
  },
  headers: {
    Accept: "application/json",
    "Accept-Language": "en",
    "Content-Type": "application/json",
    Authorization: `Bearer ${conf.authToken}`,
  },
});

api.interceptors.request.use(async (config) => {
  if (config.params) {
    config.params.include_adult =
      (await SecureStore.getItemAsync("hide_adult_content")) !== "true";
  }

  return config;
});

const queue = new SmartQueue({
  rules: {
    common: {
      rate: 5,
      limit: 1,
      priority: 1,
    },
  },
  retryTime: 300,
  ignoreOverallOverheat: true,
});

const getQueued = <T>(url: string, params?: AxiosRequestConfig): Promise<T> =>
  queue.request(
    (retry) =>
      api
        .get<T>(url, params)
        .then((response) => response.data)
        .catch((error) => {
          if (error.response.status === 429) {
            return retry(error.response.data.parameters.retry_after);
          }
          throw error;
        }),
    "default",
  );

export default api;
export { getQueued };
export * from "./models";

