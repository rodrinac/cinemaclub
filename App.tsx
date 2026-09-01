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
import { MD3DarkTheme, Provider as PaperProvider } from "react-native-paper";

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
    ...MD3DarkTheme,
    dark: true,
    colors: {
      ...MD3DarkTheme.colors,
      primary: Theme.colors.gold,
      onPrimary: Theme.colors.primaryDarker,
      primaryContainer: Theme.colors.goldDarker,
      onPrimaryContainer: Theme.colors.primaryDarker,
      secondary: Theme.colors.accentLighter,
      onSecondary: Theme.colors.primaryDarker,
      secondaryContainer: Theme.colors.surfaceAlt,
      onSecondaryContainer: Theme.colors.text,
      tertiary: Theme.colors.warning,
      onTertiary: Theme.colors.primaryDarker,
      tertiaryContainer: Theme.colors.surface,
      onTertiaryContainer: Theme.colors.text,
      error: Theme.colors.danger,
      onError: Theme.colors.text,
      background: Theme.colors.background,
      onBackground: Theme.colors.text,
      surface: Theme.colors.surface,
      onSurface: Theme.colors.text,
      surfaceVariant: Theme.colors.surfaceAlt,
      onSurfaceVariant: Theme.colors.textMuted,
      outline: Theme.colors.surfaceAlt,
      outlineVariant: Theme.colors.primary,
      elevation: {
        level0: Theme.colors.background,
        level1: Theme.colors.surface,
        level2: Theme.colors.surfaceAlt,
        level3: Theme.colors.surfaceAlt,
        level4: Theme.colors.primary,
        level5: Theme.colors.primary,
      },
      scrim: Theme.colors.backdrop,
      inverseSurface: Theme.colors.accent,
      inverseOnSurface: Theme.colors.primaryDarker,
      inversePrimary: Theme.colors.warning,
    },
  };

  return (
    <View onLayout={onLayoutRootView} style={{ flex: 1 }}>
      <StatusBar
        translucent={true}
        hidden={false}
        barStyle="light-content"
        backgroundColor={Theme.colors.primary}
      />
      <PaperProvider
        theme={theme}
        settings={{
          icon: (props) => (
            <Ionicons {...props} name={props.name as keyof typeof Ionicons.glyphMap} />
          ),
        }}
      >
        <Routes />
      </PaperProvider>
    </View>
  );
}
