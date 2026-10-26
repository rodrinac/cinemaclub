import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackButton from "@/components/BackButton";
import Theme from "@/theme";
import { useResponsiveLayout } from "@/theme/layout";

type Props = {
  title: string;
  showBack?: boolean;
  /** Actions shown on the right of the title row. */
  actions?: React.ReactNode;
  /** Content under the title, such as tabs or a search field. */
  children?: React.ReactNode;
  testID?: string;
  /** Narrower content column, to line the header up with a narrow page body. */
  maxWidth?: number;
};

const PageHeader: React.FC<Props> = ({
  title,
  showBack = false,
  actions,
  children,
  testID,
  maxWidth = Theme.layout.contentMaxWidth,
}) => {
  const insets = useSafeAreaInsets();
  const { isWide, isCompact } = useResponsiveLayout();

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + (isWide ? 28 : 12) }]}
      testID={testID}
    >
      <View style={[styles.inner, { maxWidth, paddingHorizontal: isCompact ? 20 : 32 }]}>
        {showBack && (
          <View style={styles.backRow}>
            <BackButton />
          </View>
        )}
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              { fontSize: isWide ? Theme.type.displayLarge : Theme.type.display },
            ]}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
        {children}
      </View>
    </View>
  );
};

export default PageHeader;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.border,
  },
  inner: {
    width: "100%",
    alignSelf: "center",
    paddingBottom: 12,
    gap: 12,
  },
  backRow: {
    flexDirection: "row",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flexShrink: 1,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.display,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
