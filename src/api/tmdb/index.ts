import axios, { AxiosRequestConfig, type AxiosResponse } from "axios";
import Constants from "expo-constants";
import { getLocales } from "expo-localization";
import { Platform } from "react-native";
import { persistentStorage } from "@/utils/persistentStorage";
import {
  installTmdbRateLimitRetryInterceptor,
} from "./retry";
import {
  getDiscoverCategoryEndpoint,
  type DiscoverCategoryKey,
} from "./discover";
import { resolveMoviesApiBaseUrl } from "./baseUrl";
import type { TmdbMovieList } from "./models";

const getLocale = () => getLocales()[0]?.languageTag || "en-US";

const moviesApiBaseUrlResolution = resolveMoviesApiBaseUrl({
  envBaseUrl: process.env.EXPO_PUBLIC_MOVIES_API_URL,
  expoHostUri:
    Constants.expoConfig?.hostUri ||
    Constants.platform?.hostUri ||
    Constants.experienceUrl ||
    Constants.linkingUri,
  isWeb: Platform.OS === "web",
});

if (__DEV__ && moviesApiBaseUrlResolution.warning) {
  console.warn(`[tmdb] ${moviesApiBaseUrlResolution.warning}`);
}

const api = axios.create({
  baseURL: moviesApiBaseUrlResolution.baseUrl,
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

installTmdbRateLimitRetryInterceptor(api);

export default api;
export * from "./models";
export * from "./discover";
export const getMoviesApiBaseUrl = () => moviesApiBaseUrlResolution.baseUrl;
