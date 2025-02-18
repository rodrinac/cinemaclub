import React from "react";
import { createStaticNavigation } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import Home from "./pages/Home";
import MovieDetail from "./pages/MovieDetail";
import SearchMovie from "./pages/SearchMovie";
import SearchFilters from "./pages/SearchFilters";
import Settings from "./pages/Settings";

const AppStack = createStackNavigator({
  screenOptions: {
    headerShown: false,
  },
  screens: {
    Home,
    MovieDetail,
    SearchMovie,
    SearchFilters,
    Settings,
  },
});

const Navigation = createStaticNavigation(AppStack);

const Routes = () => {
  return <Navigation />;
};

export default Routes;
