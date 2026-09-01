import axios, { AxiosRequestConfig, type AxiosResponse } from "axios";
import { getLocales } from "expo-localization";
import SmartQueue from "smart-request-balancer";
import { persistentStorage } from "@/utils/persistentStorage";
import {
  getDiscoverCategoryEndpoint,
  type DiscoverCategoryKey,
} from "./discover";
import type { TmdbMovieList } from "./models";

const getLocale = () => getLocales()[0]?.languageTag || "en-US";

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_MOVIES_API_URL || "http://localhost:3001/api",
  params: {
    language: getLocale(),
  },
  headers: {
    Accept: "application/json",
    "Accept-Language": "en",
    "Content-Type": "application/json",
  },
});

export const getDiscoverMovies = (
  category: DiscoverCategoryKey,
  page: number,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<TmdbMovieList>> => {
  return api.get<TmdbMovieList>(getDiscoverCategoryEndpoint(category), {
    ...config,
    params: {
      ...(config?.params || {}),
      page,
    },
  });
};

api.interceptors.request.use(async (config) => {
  if (config.params) {
    config.params.include_adult = (await persistentStorage.getItem("hide_adult_content")) !== "true";
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

const getQueued = <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return queue.request<T>(async (retry): Promise<T> => {
    try {
      const response = await api.get<T>(url, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        return retry(error.response.data?.parameters?.retry_after ?? 1) as never;
      }
      throw error;
    }
  }, "default");
};

export default api;
export * from "./models";
export * from "./discover";
export { getQueued };
