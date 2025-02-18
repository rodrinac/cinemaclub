import { StyleSheet } from "react-native";
import { Appbar } from "react-native-paper";
import Theme from "@/theme";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  elevated: boolean | undefined;
};

const FooterBar = ({ elevated = true }: Props) => {
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();

  return (
    <Appbar
      style={styles.container}
      safeAreaInsets={{ bottom }}
      elevated={elevated!}
    >
      <Appbar.Action
        color={Theme.colors.accent}
        rippleColor={Theme.colors.accentLighter}
        icon="grid-outline"
        onPress={() => navigation.navigate("Settings")}
      />
      <Appbar.Action
        rippleColor={Theme.colors.accentLighter}
        color={Theme.colors.accent}
        icon="search"
        onPress={() => navigation.navigate("SearchMovie")}
      />
    </Appbar>
  );
};

export default FooterBar;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.primary,
    justifyContent: "space-around",
  },
});
