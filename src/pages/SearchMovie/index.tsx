import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
} from "react-native";

import * as database from "@/api/database";
import { TmdbMovie } from "@/api/tmdb";
import { useSearchMoviesInfiniteQuery } from "@/api/tmdb/queries";
import AnimatedPressable from "@/components/AnimatedPressable";
import AppShell from "@/components/AppShell";
import HorizontalMovieCard from "@/components/HorizontalMovieCard";
import PageHeader from "@/components/PageHeader";
import Theme from "@/theme";
import { useResponsiveLayout } from "@/theme/layout";
import { blurActiveElementBeforeNavigate } from "@/utils/focus";

const RESULTS_MAX_WIDTH = 760;
const CONTROL_HEIGHT = 48;

const RowSeparator = () => <View style={styles.separator} />;

const SearchMovie = () => {
  const navigation = useNavigation();
  const { isCompact, height } = useResponsiveLayout();
  // The stack card on web grows with its content and the body can't scroll, so the
  // screen has to be pinned to the window for the results list to scroll by itself.
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
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const inputRef = useRef<TextInput>(null);
  const hasUserScrollIntentRef = useRef(false);

  const {
    data: movieList,
    isFetching,
    isError,
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

  const activeFilterCount = genreFilters?.length ?? 0;
  const hiddenByFilters = (movieList?.results.length ?? 0) - movies.length;
  const emptyState = !searchQuery
    ? { title: "Find a movie", body: "Search by title, then tap a result for details." }
    : isFetching
      ? { title: "Searching…" }
      : isError
        ? {
            title: "Search isn't available right now",
            body: "Check your connection and try again.",
          }
        : hiddenByFilters > 0
          ? {
              title: `Your genre filters hid all ${hiddenByFilters} results`,
              body: `for "${searchQuery}".`,
              showFiltersAction: true,
            }
          : {
              title: `No movies match "${searchQuery}"`,
              body: "Try a shorter or different title.",
            };

  const handleSubmitEditing = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    const query = event.nativeEvent.text;

    if (query.trim().length < 1) {
      return;
    }

    hasUserScrollIntentRef.current = false;
    setSearchQuery(query);
  };

  const handleClear = () => {
    hasUserScrollIntentRef.current = false;
    setInputText("");
    setSearchQuery("");
    inputRef.current?.focus();
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

  const openFilters = () => {
    blurActiveElementBeforeNavigate();
    navigation.navigate("SearchFilters");
  };

  // The filters are edited on their own screen, so re-read them whenever Search is shown.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function fetchFilters() {
        const [_filter, _genreFilters] = await Promise.all([
          database.getGenreFilterMode(),
          database.getGenreFilters(),
        ]);

        if (isActive) {
          setFilter(_filter || "EXCLUDING");
          setGenreFilters(_genreFilters);
        }
      }

      fetchFilters();

      return () => {
        isActive = false;
      };
    }, []),
  );

  return (
    <View style={[styles.root, screenWebStyle]}>
      <AppShell active="SearchMovie">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.screen}
        >
          <PageHeader title="Search" maxWidth={RESULTS_MAX_WIDTH}>
            <View style={styles.searchRow}>
              <View style={styles.searchField}>
                <TextInput
                  ref={inputRef}
                  style={styles.searchInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Search a movie"
                  accessibilityLabel="Search movies"
                  returnKeyType="search"
                  placeholderTextColor={Theme.colors.textMuted}
                  onSubmitEditing={handleSubmitEditing}
                  autoFocus
                />
                <View style={styles.searchIcon} pointerEvents="none">
                  <Ionicons name="search" size={20} color={Theme.colors.textMuted} />
                </View>
                {inputText.length > 0 && (
                  <AnimatedPressable
                    borderless
                    style={styles.clearButton}
                    contentStyle={styles.centered}
                    onPress={handleClear}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    testID="search-clear-button"
                  >
                    <Ionicons name="close" size={20} color={Theme.colors.accentLighter} />
                  </AnimatedPressable>
                )}
              </View>
              <View style={styles.filtersAnchor}>
                <AnimatedPressable
                  borderless
                  style={styles.filtersButton}
                  contentStyle={styles.centered}
                  onPress={openFilters}
                  accessibilityRole="button"
                  accessibilityLabel={
                    activeFilterCount
                      ? `Genre filters, ${activeFilterCount} active`
                      : "Genre filters"
                  }
                  testID="search-filters-button"
                >
                  <Ionicons name="options-outline" color={Theme.colors.accentLighter} size={22} />
                </AnimatedPressable>
                {activeFilterCount > 0 && (
                  <View style={styles.badge} pointerEvents="none">
                    <Text style={styles.badgeText} aria-hidden>
                      {activeFilterCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </PageHeader>
          <View style={styles.main}>
            {movies.length === 0 && (
              <View style={styles.emptyState} testID="search-empty-state" aria-live="polite">
                <Ionicons name="film-outline" size={40} color={Theme.colors.textMuted} />
                <Text style={styles.emptyTitle}>{emptyState.title}</Text>
                {emptyState.body && <Text style={styles.emptyBody}>{emptyState.body}</Text>}
                {emptyState.showFiltersAction && (
                  <AnimatedPressable
                    onPress={openFilters}
                    accessibilityRole="button"
                    contentStyle={styles.emptyAction}
                  >
                    <Text style={styles.emptyActionText}>Edit genre filters</Text>
                  </AnimatedPressable>
                )}
              </View>
            )}
            {movies.length > 0 && (
              <FlatList
                style={styles.movieList}
                contentContainerStyle={[
                  styles.movieListContent,
                  { paddingHorizontal: isCompact ? 20 : 32 },
                ]}
                data={movies}
                renderItem={({ item }) => (
                  <HorizontalMovieCard movie={item} onPosterPress={() => goToMovieDetails(item)} />
                )}
                keyExtractor={(item) => item.id.toString()}
                ItemSeparatorComponent={RowSeparator}
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
      </AppShell>
    </View>
  );
};

export default SearchMovie;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
    minHeight: 0,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  searchInput: {
    minHeight: CONTROL_HEIGHT,
    paddingVertical: 12,
    paddingLeft: 44,
    paddingRight: 48,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
    color: Theme.colors.text,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.body,
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  clearButton: {
    position: "absolute",
    right: 2,
    top: 2,
    bottom: 2,
    width: 44,
    borderRadius: 22,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersAnchor: {
    width: CONTROL_HEIGHT,
    height: CONTROL_HEIGHT,
  },
  filtersButton: {
    width: CONTROL_HEIGHT,
    height: CONTROL_HEIGHT,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.colors.border,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Theme.colors.background,
    backgroundColor: Theme.colors.gold,
  },
  badgeText: {
    color: Theme.colors.onGold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.label,
    lineHeight: 14,
    fontVariant: ["tabular-nums"],
  },
  main: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    ...(Platform.OS === "web" ? { overflow: "hidden" as const } : null),
  },
  movieList: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: RESULTS_MAX_WIDTH,
    alignSelf: "center",
  },
  movieListContent: {
    paddingBottom: 24,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.colors.border,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxWidth: 420,
    alignSelf: "center",
  },
  emptyTitle: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.display,
    fontSize: Theme.type.title,
    textAlign: "center",
  },
  emptyBody: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.meta,
    textAlign: "center",
  },
  emptyAction: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyActionText: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.meta,
  },
});
