import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";

import * as database from "../../api/database";
import { TmdbGenre } from "../../api/tmdb";
import Theme from "../../theme";

type Props = {
  genre: TmdbGenre;
  filter: database.GenreFilterMode;
  color: string;
};

const GenreCard: React.FC<Props> = ({ genre, color, filter }) => {
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    async function fetchGenreFilter() {
      setSelected(await database.hasGenreFilter(genre));
    }

    fetchGenreFilter();
  }, [genre]);

  async function handlePress() {
    await database.toggleGenreFilter(genre, filter);
    setSelected(!selected);
  }

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

GenreCard.defaultProps = {
  color: Theme.colors.accentLighter,
};

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
