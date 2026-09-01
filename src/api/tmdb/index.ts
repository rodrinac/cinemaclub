import axios, { AxiosRequestConfig } from "axios";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import SmartQueue from "smart-request-balancer";

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

api.interceptors.request.use(async (config) => {
  if (config.params) {
    config.params.include_adult = (await SecureStore.getItemAsync("hide_adult_content")) !== "true";
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
  return queue.request(async (retry) => {
    try {
      const response = await api.get<T>(url, config);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        return retry(error.response.data?.parameters?.retry_after ?? 1);
      }
      throw error;
    }
  }, "default");
};

export default api;
export * from "./models";
export { getQueued };
