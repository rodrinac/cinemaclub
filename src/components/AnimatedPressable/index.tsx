import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { TouchableRipple } from "react-native-paper";
import type { Props as TouchableRippleProps } from "react-native-paper/lib/typescript/components/TouchableRipple/TouchableRipple";

const PRESS_SCALE = 0.96;
const PRESS_ANIMATION_DURATION = 100;

type Props = Omit<TouchableRippleProps, "children" | "style"> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * A pressable wrapper that combines react-native-paper's TouchableRipple
 * (real Material ink ripple on Android/web, highlight fallback on iOS) with
 * a subtle Reanimated scale-down animation on press, so every interactive
 * element in the app gets consistent tactile feedback.
 */
const AnimatedPressable: React.FC<Props> = ({
  children,
  style,
  contentStyle,
  onPressIn,
  onPressOut,
  ...rest
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableRipple
      style={style}
      onPressIn={(event) => {
        scale.value = withTiming(PRESS_SCALE, { duration: PRESS_ANIMATION_DURATION });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, { duration: PRESS_ANIMATION_DURATION });
        onPressOut?.(event);
      }}
      {...rest}
    >
      <Animated.View style={[animatedStyle, contentStyle]}>{children}</Animated.View>
    </TouchableRipple>
  );
};

export default AnimatedPressable;
