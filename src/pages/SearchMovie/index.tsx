import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInputSubmitEditingEventData,
  View,
} from "react-native";
import { FlatList, TextInput, TouchableOpacity } from "react-native-gesture-handler";

import * as database from "@/api/database";
import api, { TmdbMovie, TmdbMovieList } from "@/api/tmdb";
import HorizontalMovieCard from "@/components/HorizontalMovieCard";
import Theme from "@/theme";

type PageToLoad = {
  number: number;
  searchQuery: string;
};

const PRISTINE_EMPTY_LIST: TmdbMovieList = {
  page: 0,
  results: [],
  total_pages: 0,
  total_results: 0,
};

const SearchMovie = () => {
  const navigation = useNavigation();

  const [filter, setFilter] = useState<database.GenreFilterMode>("INCLUDING");
  const [genreFilters, setGenreFilters] = useState<number[]>();
  const [currResponse, setCurrResponse] = useState<TmdbMovieList>();

  const [pageToLoad, setPageToLoad] = useState<PageToLoad>({
    number: 0,
    searchQuery: "",
  });

  const moviesRef = useRef<TmdbMovieList>(PRISTINE_EMPTY_LIST);

  const moviesPage = moviesRef.current;

  const filterMovieList = useCallback(
    (movies: TmdbMovie[]): TmdbMovie[] => {
      if (genreFilters == null || genreFilters?.length == 0) {
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

  const movies = useMemo(() => {
    if (currResponse) {
      moviesRef.current = {
        ...moviesRef.current,
        results: [...moviesRef.current.results, ...currResponse.results],
      };
    }

    return filterMovieList(moviesRef.current.results);
  }, [currResponse, filterMovieList]);
  const fetchSearchMovies = useCallback(async () => {
    const response = await api.get<TmdbMovieList>("search/movie", {
      params: {
        query: pageToLoad.searchQuery,
        page: pageToLoad.number,
        append_to_response: "credits",
      },
    });

    setCurrResponse(response.data);
  }, [pageToLoad]);

  useEffect(() => {
    if (
      pageToLoad.number > 0 &&
      (moviesPage.page === 0 || pageToLoad.number <= moviesPage.total_pages)
    ) {
      fetchSearchMovies();
    }
  }, [fetchSearchMovies, pageToLoad.number]);

  const handleSubmitEditing = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    const searchQuery = event.nativeEvent.text;

    if (searchQuery.trim().length < 1) {
      return;
    }

    moviesRef.current = PRISTINE_EMPTY_LIST;

    setPageToLoad({
      number: 1,
      searchQuery,
    });
  };

  const goToMovieDetails = (movie: TmdbMovie) => {
    navigation.navigate("MovieDetail", { movieId: movie.id });
  };

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
            placeholderTextColor={Theme.colors.accent}
            onSubmitEditing={handleSubmitEditing}
            autoFocus
          />
          <TouchableOpacity
            style={styles.searchFilter}
            onPress={() => navigation.navigate("SearchFilters")}
          >
            <Ionicons name="filter" color={Theme.colors.accentLighter} size={36} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.main}>
        {movies.length > 0 && (
          <FlatList
            data={movies}
            renderItem={({ item }) => (
              <HorizontalMovieCard movie={item} onPosterPress={() => goToMovieDetails(item)} />
            )}
            keyExtractor={(item) => item.id.toString()}
            onEndReached={() => setPageToLoad({ ...pageToLoad, number: pageToLoad.number + 1 })}
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
    paddingLeft: 24,
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
    paddingTop: 8,
    paddingBottom: 12,
  },
});
