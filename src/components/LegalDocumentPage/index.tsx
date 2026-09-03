import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "@/theme";

export type LegalSection = {
  heading: string;
  body: string;
};

type Props = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  testID?: string;
};

/**
 * Shared scrollable layout for legal/disclaimer pages (Privacy Policy,
 * Terms of Service, ...), matching the header/back-button style used by
 * the rest of the app's screens.
 */
const LegalDocumentPage: React.FC<Props> = ({ title, lastUpdated, sections, testID }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
      testID={testID}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.nav}>
          <AnimatedPressable borderless onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
          </AnimatedPressable>
        </View>
        <Text style={[styles.title, { fontSize: isLandscape ? 26 : 32 }]}>{title}</Text>
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
      </View>
      <ScrollView style={styles.main} contentContainerStyle={styles.content}>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LegalDocumentPage;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    backgroundColor: Theme.colors.primary,
    elevation: 4,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: Theme.colors.accent,
    fontSize: 32,
    fontFamily: "RobotoCondensed_700Bold",
    maxWidth: "100%",
    marginTop: 16,
  },
  lastUpdated: {
    color: Theme.colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  main: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeading: {
    color: Theme.colors.text,
    fontFamily: "RobotoCondensed_700Bold",
    fontSize: 18,
    marginBottom: 6,
  },
  sectionBody: {
    color: Theme.colors.accentLighter,
    fontSize: 14,
    lineHeight: 20,
  },
});
