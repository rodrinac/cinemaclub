import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Share, StyleProp, StyleSheet, ViewStyle } from "react-native";

import { getMovieShareUrl, type TmdbMovie } from "@/api/tmdb";
import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "@/theme";

type Props = {
  movie: TmdbMovie;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// Pads small icons up to a 44pt touch target.
const MIN_TOUCH_TARGET = 44;
const COPIED_FEEDBACK_MS = 2000;

const isShareAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

const ShareButton: React.FC<Props> = ({ movie, size = 20, style, testID }) => {
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearCopiedTimeout = () => {
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = undefined;
    }
  };

  useEffect(() => clearCopiedTimeout, []);

  const shareMovie = async () => {
    const url = getMovieShareUrl(movie.id);

    if (Platform.OS !== "web") {
      // iOS attaches `url` as a link; Android only reads `message`.
      await Share.share(Platform.OS === "ios" ? { url } : { message: url, title: movie.title });
      return;
    }

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: movie.title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearCopiedTimeout();
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch (error) {
      if (!isShareAbort(error)) {
        console.warn("[share] Unable to share movie link", error);
      }
    }
  };

  const padding = Math.max(0, (MIN_TOUCH_TARGET - size) / 2);

  return (
    <AnimatedPressable
      borderless
      style={[styles.button, style]}
      contentStyle={{ padding }}
      onPress={shareMovie}
      accessibilityRole="button"
      accessibilityLabel={copied ? `Link to ${movie.title} copied` : `Share ${movie.title}`}
      aria-live="polite"
      testID={testID}
    >
      <Ionicons
        name={copied ? "checkmark" : "share-social-outline"}
        color={Theme.colors.accent}
        size={size}
      />
    </AnimatedPressable>
  );
};

export default ShareButton;

const styles = StyleSheet.create({
  button: {
    borderRadius: MIN_TOUCH_TARGET / 2,
  },
});
