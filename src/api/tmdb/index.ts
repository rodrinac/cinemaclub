import axios, { AxiosRequestConfig } from "axios";
import { getLocales } from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { doc, getDoc } from "firebase/firestore";
import SmartQueue from "smart-request-balancer";
import { firestore } from "../firebase";

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
  },
});

api.interceptors.request.use(async (config) => {
  if (config.params) {
    config.params.include_adult = (await SecureStore.getItemAsync("hide_adult_content")) !== "true";
  }

  return config;
});

const setTmdbApiKey = async () => {
  try {
    const docRef = doc(firestore, "config", "tmdb");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      api.defaults.headers.common["Authorization"] = `Bearer ${data["API_TOKEN"]}`;
    }
  } catch (error) {
    console.error("Error fetching TMDB credentials: ", error);
  }
};

setTmdbApiKey();

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

const getQueued = <T>(url: string, params?: AxiosRequestConfig): Promise<T> => {
  return queue.request(async (retry) => {
    try {
      const response = await api.get<T>(url, params);
      return response.data;
    } catch (error: any) {
      if (error.response.status === 429) {
        return retry(error.response.data.parameters.retry_after);
      }
      throw error;
    }
  }, "default");
};

export default api;
export * from "./models";
export { getQueued };
