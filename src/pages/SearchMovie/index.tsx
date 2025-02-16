import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
} from "react-native";
import {
  TextInput,
  TouchableOpacity,
  FlatList,
} from "react-native-gesture-handler";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import api, { TmdbMovieList, TmdbMovie } from "../../api/tmdb";
import HorizontalMovieCard from "../../components/HorizontalMovieCard";
import Theme from "../../theme";
import * as database from "../../api/database";

interface PageToLoad {
  number: number;
  searchQuery: string;
}

const SearchMovie = () => {
  const navigation = useNavigation();

  const [filter, setFilter] = useState<database.GenreFilterMode>("INCLUDING");
  const [genreFilters, setGenreFilters] = useState<number[]>();
  const [foundMovies, setFoundMovies] = useState<TmdbMovieList>();

  const [pageToLoad, setPageToLoad] = useState<PageToLoad>({
    number: 0,
    searchQuery: "",
  });

  const filterMovieList = useCallback(
    (movies: TmdbMovie[]): TmdbMovie[] => {
      if (!genreFilters) {
        return movies;
      }

      if (filter === "EXCLUDING") {
        return movies.filter((movie) =>
          genreFilters.every((genre) => !movie.genre_ids.includes(genre)),
        );
      }

      return movies.filter((movie) =>
        genreFilters.some((genre) => movie.genre_ids.includes(genre)),
      );
    },
    [filter, genreFilters],
  );

  useEffect(() => {
    async function fetchFilter() {
      const _filter = (await database.getGenreFilterMode()) || "EXCLUDING";
      setFilter(_filter);
    }

    fetchFilter();
  }, []);

  useEffect(() => {
    const fetchGenreFilters = async () => {
      const _genreFilters = await database.getGenreFilters();
      setGenreFilters(_genreFilters);
    };

    fetchGenreFilters();
  }, [filter]);

  useEffect(() => {
    const requestSearchMovies = async () => {
      const response = await api.get<TmdbMovieList>("search/movie", {
        params: {
          query: pageToLoad.searchQuery,
          page: pageToLoad.number,
          append_to_response: "credits",
        },
      });

      setFoundMovies(response.data);

      const responseData = response.data;

      const movieList = (foundMovies?.results || []).concat(
        responseData.results,
      );

      setFoundMovies({ ...responseData, results: filterMovieList(movieList) });
    };

    if (
      pageToLoad.number > 0 &&
      (!foundMovies || pageToLoad.number <= foundMovies.total_pages)
    ) {
      requestSearchMovies();
    }
  }, [pageToLoad, genreFilters, foundMovies, filterMovieList]);

  const handleSubmitEditing = (
    event: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
  ) => {
    const searchQuery = event.nativeEvent.text;

    if (searchQuery.trim().length < 1) {
      return;
    }

    setPageToLoad({
      number: 1,
      searchQuery,
    });
  };

  const handleMoviePosterPress = (movie: TmdbMovie) => {
    navigation.navigate("MovieDetail", { movieId: movie.id });
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
            <Ionicons name="options" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>SEARCH</Text>
        <View style={styles.search}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search a movie"
            onSubmitEditing={handleSubmitEditing}
            autoFocus
          />
          <TouchableOpacity
            style={styles.searchFilter}
            onPress={() => navigation.navigate("SearchFilters")}
          >
            <MaterialCommunityIcons
              name="filter-outline"
              color={Theme.colors.accentLighter}
              size={36}
            />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.main}>
        {foundMovies && (
          <FlatList
            data={foundMovies.results}
            renderItem={({ item }) => (
              <HorizontalMovieCard
                movie={item}
                onPosterPress={() => handleMoviePosterPress(item)}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            onEndReached={() =>
              setPageToLoad({ ...pageToLoad, number: pageToLoad.number + 1 })
            }
            onEndReachedThreshold={0.2}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default SearchMovie;

const styles = StyleSheet.create({
  header: {
    paddingLeft: 22,
    backgroundColor: Theme.colors.primary,
    elevation: 2,
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
  search: {
    flexDirection: "row",
    marginVertical: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Theme.colors.primaryDarker,
    color: Theme.colors.accentLighter,
    fontSize: 18,
    borderRadius: 8,
    padding: 12,
  },
  searchFilter: {
    marginHorizontal: 12,
    backgroundColor: Theme.colors.primaryDarker,
    borderRadius: 8,
    padding: 8,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 12,
  },
});

