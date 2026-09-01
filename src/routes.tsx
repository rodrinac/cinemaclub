import { createStaticNavigation, type StaticParamList } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as Linking from "expo-linking";
import React from "react";
import { Platform } from "react-native";
import { appLinkingConfig } from "./navigation/linking";
import Home from "./pages/Home";
import MovieDetail from "./pages/MovieDetail";
import SearchFilters from "./pages/SearchFilters";
import SearchMovie from "./pages/SearchMovie";
import Settings from "./pages/Settings";

const AppStack = createStackNavigator({
  screenOptions: {
    headerShown: false,
    cardShadowEnabled: Platform.OS !== "web",
  },
  screens: {
    Home: {
      screen: Home,
      linking: appLinkingConfig.screens.Home,
    },
    MovieDetail: {
      screen: MovieDetail,
      linking: appLinkingConfig.screens.MovieDetail,
    },
    SearchMovie: {
      screen: SearchMovie,
      linking: appLinkingConfig.screens.SearchMovie,
    },
    SearchFilters: {
      screen: SearchFilters,
      linking: appLinkingConfig.screens.SearchFilters,
    },
    Settings: {
      screen: Settings,
      linking: appLinkingConfig.screens.Settings,
    },
  },
});

type RootStackParamList = StaticParamList<typeof AppStack>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const Navigation = createStaticNavigation(AppStack);

const Routes = () => {
  return (
    <Navigation
      linking={{
        enabled: true,
        prefixes: [Linking.createURL("/"), "http://127.0.0.1:8081", "http://localhost:8081"],
        config: appLinkingConfig,
      }}
    />
  );
};

export default Routes;
