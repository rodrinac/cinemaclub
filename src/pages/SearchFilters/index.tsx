import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { FlatList, TouchableOpacity } from "react-native-gesture-handler";
import { SegmentedButtons } from "react-native-paper";

import * as database from "@/api/database";
import api, { TmdbGenreList } from "@/api/tmdb";
import GenreCard from "@/components/GenreCard";
import Theme from "@/theme";

const SearchFilters = () => {
  const navigation = useNavigation();

  const [genreList, setGenreList] = useState<TmdbGenreList | undefined>();
  const [filterMode, setFilterMode] = useState<database.GenreFilterMode>("INCLUDING");

  useEffect(() => {
    async function fetchGenres() {
      const response = await api.get<TmdbGenreList>("genre/movie/list");

      setGenreList(response.data);
    }

    fetchGenres();
  }, []);

  useEffect(() => {
    async function fetchGenreFilter() {
      const mode = await database.getGenreFilterMode();

      if (mode !== "UNDEFINED") {
        setFilterMode(mode);
      }
    }

    fetchGenreFilter();
  }, []);

  const onFilterModeChange = (newFilter: database.GenreFilterMode) => {
    (async () => {
      await database.setGenreFilterMode(newFilter);
    })();
    setFilterMode(newFilter);
  };

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
          <SegmentedButtons
            value={filterMode}
            onValueChange={onFilterModeChange}
            style={styles.menuButtons}
            buttons={[
              {
                value: "INCLUDING",
                label: "Only these",
              },
              {
                value: "EXCLUDING",
                label: "Without these",
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.main}>
        {genreList && (
          <FlatList
            data={genreList.genres}
            renderItem={({ item }) => <GenreCard genre={item} filterMode={filterMode} />}
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
    paddingHorizontal: 24,
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
    paddingVertical: 16,
  },
  menuButtons: {
    flexGrow: 1,
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
