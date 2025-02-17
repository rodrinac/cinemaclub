import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import Home from "./pages/Home";
import MovieDetail from "./pages/MovieDetail";
import SearchMovie from "./pages/SearchMovie";
import SearchFilters from "./pages/SearchFilters";
import Settings from "./pages/Settings";

const AppStack = createStackNavigator();

const Routes = () => {
  return (
    <NavigationContainer>
      <AppStack.Navigator
        headerMode="none"
        screenOptions={{ cardStyle: { backgroundColor: "#f0f0f5" } }}
      >
        <AppStack.Screen name="Home" component={Home}></AppStack.Screen>
        <AppStack.Screen
          name="MovieDetail"
          component={MovieDetail}
        ></AppStack.Screen>
        <AppStack.Screen
          name="SearchMovie"
          component={SearchMovie}
        ></AppStack.Screen>
        <AppStack.Screen
          name="SearchFilters"
          component={SearchFilters}
        ></AppStack.Screen>
        <AppStack.Screen name="Settings" component={Settings}></AppStack.Screen>
      </AppStack.Navigator>
    </NavigationContainer>
  );
};

export default Routes;
