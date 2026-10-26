import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Switch } from "react-native-paper";
import AnimatedPressable from "@/components/AnimatedPressable";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import Theme from "@/theme";
import { useResponsiveLayout } from "@/theme/layout";
import { persistentStorage } from "@/utils/persistentStorage";

type RowProps = {
  title: string;
  description: string;
  onPress: () => void;
};

const LinkRow: React.FC<RowProps> = ({ title, description, onPress }) => (
  <AnimatedPressable onPress={onPress} contentStyle={styles.row} accessibilityRole="link">
    <View style={styles.rowText}>
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.rowDescription}>{description}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={Theme.colors.textMuted} />
  </AnimatedPressable>
);

const Settings = () => {
  const navigation = useNavigation();
  const { isCompact } = useResponsiveLayout();

  const [hideAdultContent, setHideAdultContent] = React.useState(true);

  useEffect(() => {
    async function initAdultContentState() {
      const willHideAdultContent =
        (await persistentStorage.getItem("hide_adult_content")) === "true";

      setHideAdultContent(willHideAdultContent);
    }

    initAdultContentState();
  }, []);

  async function onToggleSwitch() {
    const willHideAdultContent = !hideAdultContent;

    await persistentStorage.setItem("hide_adult_content", String(willHideAdultContent));

    setHideAdultContent(willHideAdultContent);
  }

  return (
    <AppShell active="Settings">
      <PageHeader title="Settings" />
      <ScrollView
        style={styles.main}
        contentContainerStyle={[styles.content, { paddingHorizontal: isCompact ? 20 : 32 }]}
      >
        <Text style={styles.sectionLabel}>CONTENT</Text>
        <View style={styles.group}>
          <AnimatedPressable
            onPress={onToggleSwitch}
            contentStyle={styles.row}
            accessibilityRole="switch"
            accessibilityLabel="Hide adult content"
            aria-checked={hideAdultContent}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Hide adult content</Text>
              <Text style={styles.rowDescription}>Leave adult titles out of every list and search.</Text>
            </View>
            {/* The whole row is the control; the switch only mirrors its state. */}
            <View
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Switch value={hideAdultContent} color={Theme.colors.gold} />
            </View>
          </AnimatedPressable>
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.group}>
          <LinkRow
            title="Send feedback"
            description="Tell us what to improve"
            onPress={() => navigation.navigate("Feedback")}
          />
          <LinkRow
            title="Privacy policy"
            description="How Cinema Club handles your data"
            onPress={() => navigation.navigate("PrivacyPolicy")}
          />
          <LinkRow
            title="Terms of service"
            description="The rules for using Cinema Club"
            onPress={() => navigation.navigate("TermsOfService")}
          />
        </View>
        <Text style={styles.attribution}>
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </Text>
      </ScrollView>
    </AppShell>
  );
};

export default Settings;

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    width: "100%",
    maxWidth: Theme.layout.readingMaxWidth,
    alignSelf: "center",
    paddingVertical: 20,
    gap: 8,
  },
  sectionLabel: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.label,
    letterSpacing: 1.2,
    marginTop: 12,
  },
  group: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.body,
  },
  rowDescription: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
  },
  attribution: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
    marginTop: 16,
  },
});
