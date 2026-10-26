import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";

import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "@/theme";

type Props = {
  testID?: string;
};

const BackButton: React.FC<Props> = ({ testID }) => {
  const navigation = useNavigation();

  return (
    <AnimatedPressable
      borderless
      style={{ margin: -10 }}
      contentStyle={{ padding: 10 }}
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      testID={testID}
    >
      <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
    </AnimatedPressable>
  );
};

export default BackButton;
