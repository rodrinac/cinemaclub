import { createStaticNavigation, type StaticParamList } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import React from "react";
import { Platform } from "react-native";
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
    Home,
    MovieDetail,
    SearchMovie,
    SearchFilters,
    Settings,
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
  return <Navigation />;
};

export default Routes;
