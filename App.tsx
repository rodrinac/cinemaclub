import React, { useCallback } from "react";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar, View } from "react-native";
import { DefaultTheme, Provider as PaperProvider } from "react-native-paper";
import {
  RobotoCondensed_700Bold,
  RobotoCondensed_400Regular,
} from "@expo-google-fonts/roboto-condensed";
import { Roboto_400Regular, Roboto_500Medium } from "@expo-google-fonts/roboto";
import { Ubuntu_700Bold, useFonts } from "@expo-google-fonts/ubuntu";

import Routes from "./src/routes";
import Theme from "./src/theme";

SplashScreen.preventAutoHideAsync();

SplashScreen.setOptions({
  duration: 100,
  fade: true,
});

export default function App() {
  const [fontsLoaded] = useFonts({
    RobotoCondensed_400Regular,
    RobotoCondensed_700Bold,
    Roboto_400Regular,
    Roboto_500Medium,
    Ubuntu_700Bold,
  });

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) {
      SplashScreen.hide();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const theme = {
    ...DefaultTheme,
    dark: true,
    colors: {
      ...DefaultTheme.colors,
      primary: Theme.colors.primary,
      accent: Theme.colors.accent,
      text: Theme.colors.accent,
    },
  };

  return (
    <View onLayout={onLayoutRootView} style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
          hidden
        />
        <Routes />
      </PaperProvider>
    </View>
  );
}
