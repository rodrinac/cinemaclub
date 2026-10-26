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
        <Ionicons name="sparkles" size={14} color={Theme.colors.gold} />
        <Text style={styles.label}>WHY WATCH</Text>
      </View>
      {isPending ? (
        <Text style={styles.placeholder}>Writing a quick pitch...</Text>
      ) : (
        <>
          <Text style={styles.pitch} testID="movie-pitch-text">
            {pitch.pitch}
          </Text>
          {pitch.moods.length > 0 && (
            <View style={styles.moods}>
              {pitch.moods.map((mood) => (
                <Text key={mood} style={styles.mood}>
                  {mood}
                </Text>
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

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 14,
    gap: 8,
    maxWidth: 760,
    borderRadius: 12,
    backgroundColor: Theme.colors.overlay,
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
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_700Bold",
    letterSpacing: 1,
    fontSize: 12,
  },
  placeholder: {
    color: Theme.colors.textMuted,
    fontStyle: "italic",
  },
  pitch: {
    color: Theme.colors.accent,
    lineHeight: 20,
  },
  moods: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  mood: {
    color: Theme.colors.accentLighter,
    backgroundColor: Theme.colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
  },
  disclaimer: {
    color: Theme.colors.textMuted,
    fontSize: 10,
  },
});
