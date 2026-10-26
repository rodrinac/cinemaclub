import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useMoviePitchQuery } from "@/api/tmdb/queries";
import Theme from "@/theme";

type Props = {
  movieId: number;
};

const MoviePitchCard: React.FC<Props> = ({ movieId }) => {
  const { data: pitch, isPending, isError } = useMoviePitchQuery(movieId);

  if (isError) return null;

  return (
    <View style={styles.container} testID="movie-pitch" aria-live="polite">
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={Theme.colors.gold} aria-hidden />
        <Text style={styles.label}>WHY WATCH</Text>
      </View>
      {isPending ? (
        <Text style={styles.placeholder}>Writing a quick pitch…</Text>
      ) : (
        <>
          <Text style={styles.pitch} testID="movie-pitch-text">
            {pitch.pitch}
          </Text>
          {pitch.moods.length > 0 && (
            <View style={styles.moods}>
              {pitch.moods.map((mood) => (
                <View key={mood} style={styles.mood}>
                  <Text style={styles.moodLabel}>{mood}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.disclaimer}>AI-generated from the TMDB overview</Text>
        </>
      )}
    </View>
  );
};

export default MoviePitchCard;

// A pull-quote: a square gold rule on the left and no box, so the pitch reads as
// editorial copy that is clearly set apart from the overview above it.
const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: Theme.layout.readingMaxWidth,
    gap: 12,
    paddingLeft: 16,
    paddingVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: Theme.colors.gold,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.label,
    letterSpacing: 1.5,
  },
  placeholder: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.displayItalic,
    fontSize: Theme.type.body,
  },
  pitch: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.displayItalic,
    fontSize: Theme.type.title,
    lineHeight: 30,
  },
  moods: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mood: {
    backgroundColor: Theme.colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  moodLabel: {
    color: Theme.colors.accentLighter,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.caption,
  },
  disclaimer: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
  },
});
