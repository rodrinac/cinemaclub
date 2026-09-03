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
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as database from "@/api/database";
import { TmdbMovie } from "@/api/tmdb";
import { useSearchMoviesInfiniteQuery } from "@/api/tmdb/queries";
import HorizontalMovieCard from "@/components/HorizontalMovieCard";
import AnimatedPressable from "@/components/AnimatedPressable";
import Theme from "@/theme";
import { blurActiveElementBeforeNavigate } from "@/utils/focus";

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
  const [searchQuery, setSearchQuery] = useState("");

  const hasUserScrollIntentRef = useRef(false);

  const {
    data: movieList,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useSearchMoviesInfiniteQuery(searchQuery);

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
    return filterMovieList(movieList?.results ?? []);
  }, [filterMovieList, movieList?.results]);

  const handleSubmitEditing = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    const query = event.nativeEvent.text;

    if (query.trim().length < 1) {
      return;
    }

    hasUserScrollIntentRef.current = false;
    setSearchQuery(query);
  };

  const handleEndReached = useCallback(() => {
    if (!hasUserScrollIntentRef.current || isFetchingNextPage || !hasNextPage) {
      return;
    }

    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const goToMovieDetails = (movie: TmdbMovie) => {
    blurActiveElementBeforeNavigate();
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
          <AnimatedPressable borderless onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
          </AnimatedPressable>
          <AnimatedPressable borderless onPress={() => navigation.navigate("Settings")}>
            <Ionicons name="options" size={24} color={Theme.colors.accent} />
          </AnimatedPressable>
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
          <AnimatedPressable
            borderless
            contentStyle={styles.searchFilter}
            onPress={() => navigation.navigate("SearchFilters")}
          >
            <Ionicons name="filter" color={Theme.colors.accentLighter} size={36} />
          </AnimatedPressable>
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
