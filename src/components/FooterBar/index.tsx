import Theme from "@/theme";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  elevated?: boolean;
};

export const FOOTER_BAR_BASE_HEIGHT = 56;

const FooterBar = ({ elevated = true }: Props) => {
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottom,
        },
        Platform.OS !== "web" && elevated ? styles.elevated : undefined,
      ]}
    >
      <TouchableOpacity
        accessibilityLabel="Open settings"
        onPress={() => navigation.navigate("Settings")}
        style={styles.action}
        testID="footer-settings"
      >
        <Ionicons color={Theme.colors.accent} name="grid-outline" size={24} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityLabel="Open search"
        onPress={() => navigation.navigate("SearchMovie")}
        style={styles.action}
        testID="footer-search"
      >
        <Ionicons color={Theme.colors.accent} name="search" size={24} />
      </TouchableOpacity>
    </View>
  );
};

export default FooterBar;

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: Theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceAlt,
    flexDirection: "row",
    justifyContent: "space-around",
    minHeight: FOOTER_BAR_BASE_HEIGHT,
  },
  elevated: {
    elevation: 4,
    shadowColor: Theme.colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: -2,
    },
  },
  action: {
    padding: 12,
  },
});
