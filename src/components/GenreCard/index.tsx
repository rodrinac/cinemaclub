import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";

import * as database from "@/api/database";
import { TmdbGenre } from "@/api/tmdb";
import Theme from "@/theme";

type Props = {
  genre: TmdbGenre;
  filterMode: database.GenreFilterMode;
};

const withoutTheseColor = "#ED0000";
const withTheseColor = "#B7990D";

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

  const handlePress = () => {
    (async () => await database.toggleGenreFilter(genre, filterMode))();
    console.log({ selected, genre, filterMode });
    setSelected(!selected);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handlePress}>
        <Feather color={selected ? color : Theme.colors.accentLighter} name="circle" size={18} />
        <Text style={[styles.title, { color: selected ? color : Theme.colors.accentLighter }]}>
          {genre.name}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default GenreCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
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
