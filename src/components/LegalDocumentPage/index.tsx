import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import PageHeader from "@/components/PageHeader";
import Theme from "@/theme";
import { useResponsiveLayout } from "@/theme/layout";

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
  const { isCompact } = useResponsiveLayout();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
      testID={testID}
    >
      <PageHeader title={title} showBack>
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
      </PageHeader>
      <ScrollView
        style={styles.main}
        contentContainerStyle={[styles.content, { paddingHorizontal: isCompact ? 20 : 32 }]}
      >
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
  lastUpdated: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
  },
  main: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    width: "100%",
    maxWidth: Theme.layout.readingMaxWidth,
    alignSelf: "center",
    paddingVertical: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.display,
    fontSize: Theme.type.title,
    marginBottom: 8,
  },
  sectionBody: {
    color: Theme.colors.accentLighter,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.meta,
    lineHeight: 24,
  },
});
