import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import * as database from "@/api/database";
import { TmdbGenre } from "@/api/tmdb";
import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "@/theme";

type Props = {
  genre: TmdbGenre;
  filterMode: database.GenreFilterMode;
};

const withoutTheseColor = Theme.colors.danger;
const withTheseColor = Theme.colors.warning;

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
  const iconName = !selected
    ? "circle"
    : filterMode === "EXCLUDING"
      ? "x-circle"
      : "check-circle";
  const actionLabel = filterMode === "EXCLUDING" ? "Exclude" : "Include";

  const handlePress = () => {
    (async () => await database.toggleGenreFilter(genre))();
    setSelected(!selected);
  };

  return (
    <View style={styles.container}>
      <AnimatedPressable
        contentStyle={styles.button}
        onPress={handlePress}
        accessibilityRole="checkbox"
        accessibilityLabel={`${actionLabel} ${genre.name}`}
        aria-checked={selected}
      >
        <>
          <Feather color={selected ? color : Theme.colors.accentLighter} name={iconName} size={18} />
          <Text style={[styles.title, { color: selected ? color : Theme.colors.accentLighter }]}>
            {genre.name}
          </Text>
        </>
      </AnimatedPressable>
    </View>
  );
};

export default GenreCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.surfaceAlt,
    margin: 8,
    borderRadius: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  title: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 18,
  },
});
