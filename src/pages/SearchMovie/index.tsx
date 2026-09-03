import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as database from "@/api/database";
import api, { TmdbMovie, TmdbMovieList } from "@/api/tmdb";
import HorizontalMovieCard from "@/components/HorizontalMovieCard";
import Theme from "@/theme";
import { mergeUniqueMovies } from "@/utils/movieList";
import { shouldFetchSearchPage, shouldLoadNextSearchPage } from "./pagination";

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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const screenWebStyle =
    Platform.OS === "web"
      ? {
          overflow: "hidden" as const,
          height,
          maxHeight: height,
        }
      : null;

  const [filter, setFilter] = useState<database.GenreFilterMode>("INCLUDING");
  const [genreFilters, setGenreFilters] = useState<number[]>();
  const [movieList, setMovieList] = useState<TmdbMovieList>(PRISTINE_EMPTY_LIST);

  const [pageToLoad, setPageToLoad] = useState<PageToLoad>({
    number: 0,
    searchQuery: "",
  });

  const movieListRef = useRef<TmdbMovieList>(PRISTINE_EMPTY_LIST);
  const isFetchingNextPageRef = useRef(false);
  const hasUserScrollIntentRef = useRef(false);
  const requestIdRef = useRef(0);

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
    return filterMovieList(movieList.results);
  }, [filterMovieList, movieList.results]);

  const fetchSearchMovies = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const response = await api.get<TmdbMovieList>("search/movies", {
        params: {
          query: pageToLoad.searchQuery,
          page: pageToLoad.number,
          append_to_response: "credits",
        },
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      setMovieList((previousMovieList) => {
        const currentResults = pageToLoad.number === 1 ? [] : previousMovieList.results;
        const nextMovieList = {
          ...response.data,
          results: mergeUniqueMovies(currentResults, response.data.results),
        };

        movieListRef.current = nextMovieList;
        return nextMovieList;
      });
    } finally {
      if (requestId === requestIdRef.current) {
        isFetchingNextPageRef.current = false;
      }
    }
  }, [pageToLoad]);

  useEffect(() => {
    if (
      !shouldFetchSearchPage({
        requestedPage: pageToLoad.number,
        searchQuery: pageToLoad.searchQuery,
        totalPages: movieListRef.current.total_pages,
      })
    ) {
      isFetchingNextPageRef.current = false;
      return;
    }

    fetchSearchMovies();
  }, [fetchSearchMovies, pageToLoad.number, pageToLoad.searchQuery]);

  const handleSubmitEditing = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    const searchQuery = event.nativeEvent.text;

    if (searchQuery.trim().length < 1) {
      return;
    }

    hasUserScrollIntentRef.current = false;
    isFetchingNextPageRef.current = false;
    movieListRef.current = PRISTINE_EMPTY_LIST;
    setMovieList(PRISTINE_EMPTY_LIST);

    setPageToLoad({
      number: 1,
      searchQuery,
    });
  };

  const handleEndReached = useCallback(() => {
    if (
      !hasUserScrollIntentRef.current ||
      !shouldLoadNextSearchPage({
        hasQuery: pageToLoad.searchQuery.trim().length > 0,
        page: movieListRef.current.page,
        totalPages: movieListRef.current.total_pages,
        isFetchingNextPage: isFetchingNextPageRef.current,
      })
    ) {
      return;
    }

    isFetchingNextPageRef.current = true;
    setPageToLoad((currentPage) => ({
      ...currentPage,
      number: currentPage.number + 1,
    }));
  }, [pageToLoad.searchQuery]);

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
      style={[{ flex: 1 }, screenWebStyle]}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="options" size={24} color={Theme.colors.accent} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.title, { fontSize: isLandscape ? 26 : 32 }]}>SEARCH</Text>
        <View style={[styles.search, isLandscape ? styles.searchLandscape : null]}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search a movie"
            placeholderTextColor={Theme.colors.textMuted}
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
            style={styles.movieList}
            data={movies}
            renderItem={({ item }) => (
              <HorizontalMovieCard movie={item} onPosterPress={() => goToMovieDetails(item)} />
            )}
            keyExtractor={(item) => item.id.toString()}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.2}
            onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              if (event.nativeEvent.contentOffset.y > 0) {
                hasUserScrollIntentRef.current = true;
              }
            }}
            onScrollBeginDrag={() => {
              hasUserScrollIntentRef.current = true;
            }}
            scrollEventThrottle={16}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default SearchMovie;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    backgroundColor: Theme.colors.primary,
    elevation: 2,
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
  search: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 12,
  },
  searchLandscape: {
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    color: Theme.colors.text,
    fontSize: 18,
    borderRadius: 8,
    padding: 12,
  },
  searchFilter: {
    backgroundColor: Theme.colors.surface,
    borderRadius: 8,
    padding: 8,
  },
  main: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    ...(Platform.OS === "web" ? { overflow: "hidden" as const } : null),
  },
  movieList: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
});
