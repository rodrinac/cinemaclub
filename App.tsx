import React from 'react';
import { AppLoading } from 'expo';
import { StatusBar } from 'react-native';
import { DefaultTheme, Provider as PaperProvider } from 'react-native-paper';
import { RobotoCondensed_700Bold, RobotoCondensed_400Regular } from '@expo-google-fonts/roboto-condensed';
import { Roboto_400Regular, Roboto_500Medium } from '@expo-google-fonts/roboto';
import { Ubuntu_700Bold, useFonts } from '@expo-google-fonts/ubuntu';

import Routes from './src/routes';
import Theme from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    RobotoCondensed_400Regular,
    RobotoCondensed_700Bold,
    Roboto_400Regular,
    Roboto_500Medium,
    Ubuntu_700Bold
  });

  if (!fontsLoaded) {
    return <AppLoading />
  }

  const theme = {
    ...DefaultTheme,
    dark: true,
    colors: {
      ...DefaultTheme.colors,
      primary: Theme.colors.primary,
      accent: Theme.colors.accent,
      text: Theme.colors.accent,
    }
  };
  
  return (
    <PaperProvider theme={theme}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent/>
      <Routes />
    </PaperProvider>  
  );
}