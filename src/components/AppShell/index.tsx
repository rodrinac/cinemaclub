import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "@/theme";
import { BrandArt } from "@/theme/brandArt";
import { useResponsiveLayout } from "@/theme/layout";
import { blurActiveElementBeforeNavigate } from "@/utils/focus";

export type AppDestination = "Home" | "SearchMovie" | "Saved" | "Settings";

type Props = {
  active?: AppDestination;
  children: React.ReactNode;
};

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const DESTINATIONS: ReadonlyArray<{
  key: AppDestination;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
  testID: string;
}> = [
  { key: "Home", label: "Discover", icon: "film-outline", activeIcon: "film", testID: "footer-home" },
  { key: "SearchMovie", label: "Search", icon: "search-outline", activeIcon: "search", testID: "footer-search" },
  { key: "Saved", label: "Saved", icon: "bookmark-outline", activeIcon: "bookmark", testID: "footer-saved" },
  { key: "Settings", label: "Settings", icon: "settings-outline", activeIcon: "settings", testID: "footer-settings" },
];

export const TAB_BAR_HEIGHT = 60;

/**
 * Top-level page frame. Phones and tablets get a labelled bottom tab bar;
 * desktop-width windows get a left navigation rail instead, so the content
 * column keeps its full height.
 */
const AppShell: React.FC<Props> = ({ active, children }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { bottom } = useSafeAreaInsets();
  const { isWide, height } = useResponsiveLayout();
  // React Navigation's web card only sets min-height, so pin the shell to the
  // window or inner lists grow instead of scrolling.
  const webFill = Platform.OS === "web" ? [styles.webFill, { height, maxHeight: height }] : null;

  const goTo = (destination: AppDestination) => {
    // Sub-pages (Filters, a movie) highlight their parent tab but can still
    // navigate back to it.
    if (destination === route.name) return;
    blurActiveElementBeforeNavigate();
    navigation.navigate(destination);
  };

  const items = DESTINATIONS.map((destination) => {
    const isActive = destination.key === active;

    return (
      <AnimatedPressable
        key={destination.key}
        borderless
        style={isWide ? styles.railItem : styles.tabItem}
        contentStyle={styles.itemContent}
        onPress={() => goTo(destination.key)}
        accessibilityRole="tab"
        accessibilityLabel={destination.label}
        aria-selected={isActive}
        testID={destination.testID}
      >
        <Ionicons
          name={isActive ? destination.activeIcon : destination.icon}
          size={22}
          color={isActive ? Theme.colors.gold : Theme.colors.accentLighter}
        />
        <Text style={[styles.itemLabel, isActive ? styles.itemLabelActive : null]}>
          {destination.label}
        </Text>
      </AnimatedPressable>
    );
  });

  if (isWide) {
    return (
      <View style={[styles.wideRoot, webFill]}>
        <View style={styles.rail} accessibilityRole="tablist" aria-label="Main navigation">
          <Image
            source={BrandArt.logoMark}
            style={styles.railMark}
            accessible={false}
            testID="app-logo"
          />
          {items}
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.compactRoot, webFill]}>
      <View style={styles.content}>{children}</View>
      <View
        style={[styles.tabBar, { paddingBottom: bottom }]}
        accessibilityRole="tablist"
        aria-label="Main navigation"
      >
        {items}
      </View>
    </View>
  );
};

export default AppShell;

const styles = StyleSheet.create({
  compactRoot: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.colors.background,
  },
  wideRoot: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    backgroundColor: Theme.colors.background,
  },
  webFill: {
    overflow: "hidden",
  },
  content: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    minHeight: TAB_BAR_HEIGHT,
    backgroundColor: Theme.colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.border,
  },
  tabItem: {
    flex: 1,
    borderRadius: 12,
  },
  rail: {
    width: Theme.layout.railWidth,
    paddingTop: 20,
    gap: 8,
    alignItems: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Theme.colors.border,
  },
  railMark: {
    width: 40,
    height: 40,
    marginBottom: 16,
  },
  railItem: {
    width: 72,
    borderRadius: 12,
  },
  itemContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 52,
    paddingVertical: 6,
  },
  itemLabel: {
    color: Theme.colors.accentLighter,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.label,
  },
  itemLabelActive: {
    color: Theme.colors.gold,
  },
});
