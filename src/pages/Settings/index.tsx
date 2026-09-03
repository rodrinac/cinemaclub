import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as StoreReview from "expo-store-review";
import React, { useEffect } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { List, Switch } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "../../theme";
import { persistentStorage } from "@/utils/persistentStorage";

const Settings = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.nav}>
          <AnimatedPressable borderless onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
          </AnimatedPressable>
        </View>
        <Text style={[styles.title, { fontSize: isLandscape ? 26 : 32 }]}>SETTINGS</Text>
      </View>
      <View style={styles.main}>
        <AnimatedPressable onPress={onToggleSwitch} contentStyle={styles.listItem}>
          <List.Item
            title="Adult Content"
            description="Hide adult content"
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
            accessibilityValue={{ text: "adult.content" }}
            style={{ flex: 1 }}
          />
          <Switch value={hideAdultContent} onValueChange={onToggleSwitch} color={Theme.colors.gold} />
        </AnimatedPressable>
        <TouchableOpacity style={styles.listItem}>
          <List.Item
            title="Privacy"
            description="Terms of Service"
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
            accessibilityValue={{ text: "terms.of.service" }}
            style={{ flex: 1 }}
          />
        </TouchableOpacity>
        <AnimatedPressable contentStyle={styles.listItem} onPress={() => StoreReview.requestReview()}>
          <List.Item
            title="Review"
            description="Send your feedback"
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDescription}
            accessibilityValue={{ text: "send.your.feedback" }}
            style={{ flex: 1 }}
          />
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  );
};

export default Settings;

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
  main: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.colors.surfaceAlt,
  },
  listTitle: {
    color: Theme.colors.text,
  },
  listDescription: {
    color: Theme.colors.textMuted,
  },
});
