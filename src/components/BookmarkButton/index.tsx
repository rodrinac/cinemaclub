import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";

import * as database from "@/api/database";
import type { TmdbMovie } from "@/api/tmdb";
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

const BookmarkButton: React.FC<Props> = ({ movie, size = 20, style, testID }) => {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    let isActive = true;

    database.hasBookmark(movie).then((hasBookmark) => {
      if (isActive) setBookmarked(hasBookmark);
    });

    return () => {
      isActive = false;
    };
  }, [movie]);

  const toggleBookmark = async () => {
    if (bookmarked) {
      await database.removeBookmark(movie);
    } else {
      await database.addBookmark(movie);
    }

    setBookmarked(!bookmarked);
  };

  const padding = Math.max(0, (MIN_TOUCH_TARGET - size) / 2);

  return (
    <AnimatedPressable
      borderless
      style={[styles.button, style]}
      contentStyle={{ padding }}
      onPress={toggleBookmark}
      accessibilityRole="button"
      accessibilityLabel={bookmarked ? `Remove ${movie.title} from saved` : `Save ${movie.title}`}
      testID={testID}
    >
      <Ionicons
        name={bookmarked ? "bookmark" : "bookmark-outline"}
        color={bookmarked ? Theme.colors.gold : Theme.colors.accent}
        size={size}
      />
    </AnimatedPressable>
  );
};

export default BookmarkButton;

const styles = StyleSheet.create({
  button: {
    borderRadius: MIN_TOUCH_TARGET / 2,
  },
});
