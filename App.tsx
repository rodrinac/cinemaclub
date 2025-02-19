import { initDB } from "@/api/database";
import Routes from "@/routes";
import Theme from "@/theme";
import { Roboto_400Regular, Roboto_500Medium } from "@expo-google-fonts/roboto";
import {
  RobotoCondensed_400Regular,
  RobotoCondensed_700Bold,
} from "@expo-google-fonts/roboto-condensed";
import { Ubuntu_700Bold, useFonts } from "@expo-google-fonts/ubuntu";
import { Ionicons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback } from "react";
import { StatusBar, View } from "react-native";
import "react-native-gesture-handler";
import { DefaultTheme, Provider as PaperProvider } from "react-native-paper";

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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await initDB();
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
      onSurface: Theme.colors.accentLighter,
    },
  };

  return (
    <View onLayout={onLayoutRootView} style={{ flex: 1 }}>
      <StatusBar
        translucent={true}
        hidden={false}
        barStyle="light-content"
        backgroundColor="#1C2646"
      />
      <PaperProvider
        theme={theme}
        settings={{
          icon: (props) => <Ionicons {...props} />,
        }}
      >
        <Routes />
      </PaperProvider>
    </View>
  );
}
