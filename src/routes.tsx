import { createStaticNavigation, type StaticParamList } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import * as Linking from "expo-linking";
import React from "react";
import { Platform } from "react-native";
import { appLinkingConfig } from "./navigation/linking";
import Feedback from "./pages/Feedback";
import Home from "./pages/Home";
import MovieDetail from "./pages/MovieDetail";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import SearchFilters from "./pages/SearchFilters";
import SearchMovie from "./pages/SearchMovie";
import Settings from "./pages/Settings";
import TermsOfService from "./pages/TermsOfService";

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
    PrivacyPolicy: {
      screen: PrivacyPolicy,
      linking: appLinkingConfig.screens.PrivacyPolicy,
    },
    TermsOfService: {
      screen: TermsOfService,
      linking: appLinkingConfig.screens.TermsOfService,
    },
    Feedback: {
      screen: Feedback,
      linking: appLinkingConfig.screens.Feedback,
    },
  },
});

type RootStackParamList = StaticParamList<typeof AppStack>;

const WEB_ROUTE_TITLES = {
  Home: "Cinema Club",
  MovieDetail: "Cinema Club • Movie",
  SearchMovie: "Cinema Club • Search",
  SearchFilters: "Cinema Club • Filters",
  Settings: "Cinema Club • Settings",
  PrivacyPolicy: "Cinema Club • Privacy Policy",
  TermsOfService: "Cinema Club • Terms of Service",
  Feedback: "Cinema Club • Feedback",
} as const;

type WebTitleRouteName = keyof typeof WEB_ROUTE_TITLES;

type NavigationStateLike = {
  index?: number;
  routes: ReadonlyArray<{
    name: string;
    state?: NavigationStateLike;
  }>;
};

const isWebTitleRouteName = (routeName: string): routeName is WebTitleRouteName =>
  routeName in WEB_ROUTE_TITLES;

const getActiveRouteName = (state?: NavigationStateLike): WebTitleRouteName | undefined => {
  if (!state?.routes.length) {
    return undefined;
  }

  const activeRoute = state.routes[state.index ?? state.routes.length - 1];
  const nestedRouteName = getActiveRouteName(activeRoute.state);

  if (nestedRouteName) {
    return nestedRouteName;
  }

  return isWebTitleRouteName(activeRoute.name) ? activeRoute.name : undefined;
};

const updateWebDocumentTitle = (state?: NavigationStateLike) => {
  if (Platform.OS !== "web") {
    return;
  }

  const activeRouteName = getActiveRouteName(state) ?? "Home";
  document.title = WEB_ROUTE_TITLES[activeRouteName];
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const Navigation = createStaticNavigation(AppStack);

const Routes = () => {
  const navigationRef = React.useRef<React.ComponentRef<typeof Navigation>>(null);
  const handleReady = React.useCallback(() => {
    updateWebDocumentTitle(navigationRef.current?.getRootState() as NavigationStateLike | undefined);
  }, []);
  const handleStateChange = React.useCallback((state?: NavigationStateLike) => {
    updateWebDocumentTitle(state);
  }, []);

  return (
    <Navigation
      ref={navigationRef}
      documentTitle={{ enabled: false }}
      linking={{
        enabled: true,
        prefixes: [Linking.createURL("/"), "http://127.0.0.1:8081", "http://localhost:8081"],
        config: appLinkingConfig,
      }}
      onReady={handleReady}
      onStateChange={handleStateChange}
    />
  );
};

export default Routes;
