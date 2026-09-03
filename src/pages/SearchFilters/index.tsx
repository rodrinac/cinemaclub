import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SegmentedButtons } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as database from "@/api/database";
import api, { TmdbGenreList } from "@/api/tmdb";
import AnimatedPressable from "@/components/AnimatedPressable";
import GenreCard from "@/components/GenreCard";
import Theme from "@/theme";

const SearchFilters = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = width >= 1200 ? 4 : width >= 768 || isLandscape ? 3 : 2;

  const [genreList, setGenreList] = useState<TmdbGenreList | undefined>();
  const [filterMode, setFilterMode] = useState<database.GenreFilterMode>("INCLUDING");

  useEffect(() => {
    async function fetchGenres() {
      const response = await api.get<TmdbGenreList>("genres");

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
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.nav}>
          <AnimatedPressable borderless onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
          </AnimatedPressable>
          <AnimatedPressable borderless onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="options" color={Theme.colors.accent} size={24} />
          </AnimatedPressable>
        </View>
        <Text style={[styles.title, { fontSize: isLandscape ? 26 : 32 }]}>FILTERS</Text>
        <View style={styles.menu}>
          <SegmentedButtons
            value={filterMode}
            onValueChange={(value) => onFilterModeChange(value as database.GenreFilterMode)}
            style={styles.menuButtons}
            theme={{
              colors: {
                secondaryContainer: Theme.colors.surfaceAlt,
                onSecondaryContainer: Theme.colors.accent,
              },
            }}
            buttons={[
              {
                value: "INCLUDING",
                label: "Only these",
                checkedColor: Theme.colors.accent,
                uncheckedColor: Theme.colors.textMuted,
                style: styles.segment,
              },
              {
                value: "EXCLUDING",
                label: "Without these",
                checkedColor: Theme.colors.accent,
                uncheckedColor: Theme.colors.textMuted,
                style: styles.segment,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.main}>
        {genreList && (
          <FlatList
            key={`filters-columns-${numColumns}`}
            data={genreList.genres}
            renderItem={({ item }) => <GenreCard genre={item} filterMode={filterMode} />}
            keyExtractor={(item) => item.id.toString()}
            numColumns={numColumns}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default SearchFilters;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    backgroundColor: Theme.colors.primary,
    elevation: 4,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: Theme.colors.accent,
    fontSize: 32,
    fontFamily: "RobotoCondensed_700Bold",
    marginTop: 16,
    maxWidth: "100%",
  },
  menu: {
    paddingVertical: 16,
  },
  menuButtons: {
    flexGrow: 1,
  },
  segment: {
    borderColor: Theme.colors.surfaceAlt,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  listContent: {
    rowGap: 4,
  },
});
