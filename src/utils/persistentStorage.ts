import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const getWebStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

const getItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === "web") {
    return getWebStorage()?.getItem(key) ?? null;
  }

  return SecureStore.getItemAsync(key);
};

const setItem = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === "web") {
    getWebStorage()?.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
};

export const persistentStorage = {
  getItem,
  setItem,
};
