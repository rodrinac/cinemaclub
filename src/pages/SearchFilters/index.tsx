import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from "react-native";
import { TouchableOpacity, FlatList } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import api, { TmdbGenreList } from "../../api/tmdb";
import Theme from "../../theme";
import GenreCard from "../../components/GenreCard";
import * as database from "../../api/database";

const SearchFilters = () => {
  const navigation = useNavigation();

  const withoutTheseColor = "#ED0000";
  const withTheseColor = "#B7990D";

  const [genreList, setGenreList] = useState<TmdbGenreList>();
  const [filter, setFilter] = useState<database.GenreFilterMode>("INCLUDING");
  const [color, setColor] = useState(withTheseColor);

  useEffect(() => {
    async function fetchGenres() {
      const response = await api.get<TmdbGenreList>("genre/movie/list");

      setGenreList(response.data);
    }

    fetchGenres();
  }, []);

  useEffect(() => {
    async function fetchGenreFilter() {
      setFilter((await database.getGenreFilterMode()) || "INCLUDING");
    }

    fetchGenreFilter();
  }, []);

  useEffect(() => {
    if (filter === "INCLUDING") {
      setColor(withTheseColor);
    } else {
      setColor(withoutTheseColor);
    }
  }, [filter]);

  async function handleFilterPress(newFilter: database.GenreFilterMode) {
    await database.setGenreFilterMode(newFilter);
    setFilter(newFilter);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.header}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="options" color="#FFF" size={24} />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>FILTERS</Text>
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem}>
            <Text
              style={[
                styles.menuItemText,
                filter === "INCLUDING" ? styles.menuItemTextActive : {},
              ]}
              onPress={() => handleFilterPress("INCLUDING")}
            >
              Only these
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text
              style={[
                styles.menuItemText,
                filter === "EXCLUDING" ? styles.menuItemTextActive : {},
              ]}
              onPress={() => handleFilterPress("EXCLUDING")}
            >
              Without these
            </Text>
          </TouchableOpacity>
          <Text style={styles.menuItem}> </Text>
        </View>
      </View>
      <View style={styles.main}>
        {genreList && (
          <FlatList
            data={genreList.genres}
            renderItem={({ item }) => (
              <GenreCard color={color} genre={item} filter={filter} />
            )}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default SearchFilters;

const styles = StyleSheet.create({
  header: {
    paddingLeft: 22,
    backgroundColor: Theme.colors.primary,
    elevation: 4,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    position: "absolute",
    top: 32,
    left: 32,
    right: 32,
  },
  title: {
    color: Theme.colors.accent,
    fontSize: 32,
    fontFamily: "RobotoCondensed_700Bold",
    maxWidth: 260,
    marginTop: 64,
  },
  menu: {
    fontSize: 16,
    marginVertical: 16,
    flexDirection: "row",
  },
  menuItem: {
    marginEnd: 12,
  },
  menuItemText: {
    color: Theme.colors.accentLighter,
    fontFamily: "Roboto_400Regular",
    fontWeight: "bold",
  },
  menuItemTextActive: {
    color: Theme.colors.accent,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
});
