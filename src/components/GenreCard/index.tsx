import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text } from "react-native";

import * as database from "@/api/database";
import { TmdbGenre } from "@/api/tmdb";
import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "@/theme";

type Props = {
  genre: TmdbGenre;
  filterMode: database.GenreFilterMode;
};

const withoutTheseColor = Theme.colors.danger;
const withTheseColor = Theme.colors.gold;

const GenreCard: React.FC<Props> = ({ genre, filterMode }) => {
  const [selected, setSelected] = useState(false);

  const color = useMemo(() => {
    switch (filterMode) {
      case "INCLUDING":
        return withTheseColor;
      case "EXCLUDING":
        return withoutTheseColor;
      default:
        return Theme.colors.accentLighter;
    }
  }, [filterMode]);

  useEffect(() => {
    async function fetchGenreFilter() {
      setSelected(await database.hasGenreFilter(genre));
    }

    fetchGenreFilter();
  }, [genre]);

  // Shape, not just color, tells included and excluded genres apart.
  const iconName = !selected ? "circle" : filterMode === "EXCLUDING" ? "x-circle" : "check-circle";
  const actionLabel = filterMode === "EXCLUDING" ? "Exclude" : "Include";

  const handlePress = () => {
    (async () => await database.toggleGenreFilter(genre))();
    setSelected(!selected);
  };

  return (
    <AnimatedPressable
      borderless
      style={[
        styles.card,
        selected ? { backgroundColor: Theme.colors.surfaceAlt, borderColor: color } : null,
      ]}
      contentStyle={styles.content}
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityLabel={`${actionLabel} ${genre.name}`}
      aria-checked={selected}
    >
      <Feather color={selected ? color : Theme.colors.textMuted} name={iconName} size={18} />
      <Text style={[styles.title, selected ? styles.titleSelected : null]} numberOfLines={2}>
        {genre.name}
      </Text>
    </AnimatedPressable>
  );
};

export default GenreCard;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    flex: 1,
    color: Theme.colors.accentLighter,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.meta,
    lineHeight: 20,
  },
  titleSelected: {
    color: Theme.colors.text,
  },
});
