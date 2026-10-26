import { TmdbMovie } from "@/api/tmdb";
import { useDiscoverMoviesInfiniteQuery } from "@/api/tmdb/queries";
import AnimatedPressable from "@/components/AnimatedPressable";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import VerticalMovieCard, { VerticalMovieCardSkeleton } from "@/components/VerticalMovieCard";
import Theme from "@/theme";
import { getPosterColumns, useResponsiveLayout } from "@/theme/layout";
import { blurActiveElementBeforeNavigate } from "@/utils/focus";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { DISCOVER_CATEGORIES, DISCOVER_CATEGORY_BY_KEY } from "./discoverCategories";

const DISCOVER_LOAD_ERROR = "Could not load discover movies. Please try again.";

// Each card adds 6px of its own side padding, so these land the poster edges on the
// page header's 20px (phone) and 32px (wider) margins.
const COMPACT_LIST_GUTTER = 14;
const WIDE_LIST_GUTTER = 26;

const SKELETON_ROWS = 3;

const getDiscoverLoadErrorMessage = (error: unknown) => {
  if (!__DEV__) {
    return DISCOVER_LOAD_ERROR;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ? `HTTP ${error.response.status}` : "Network error";
    const detail =
      typeof error.response?.data?.error === "string"
        ? error.response.data.error
        : error.message || "Request failed";

    return `${DISCOVER_LOAD_ERROR} (${status}: ${detail})`;
  }

  if (error instanceof Error && error.message) {
    return `${DISCOVER_LOAD_ERROR} (${error.message})`;
  }

  return DISCOVER_LOAD_ERROR;
};

type SkeletonGridProps = {
  numColumns: number;
  gutter: number;
};

const SkeletonGrid = ({ numColumns, gutter }: SkeletonGridProps) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.5, { duration: 900 }), -1, true);

    return () => cancelAnimation(opacity);
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.content, styles.skeletonGrid, { paddingHorizontal: gutter }, pulseStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading discover movies"
      testID="home-loading-state"
    >
      {Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
        <View key={rowIndex} style={styles.skeletonRow}>
          {Array.from({ length: numColumns }, (_, columnIndex) => (
            <VerticalMovieCardSkeleton key={columnIndex} columns={numColumns} />
          ))}
        </View>
      ))}
    </Animated.View>
  );
};

const Home = () => {
  const navigation = useNavigation();
  const { contentWidth, height, isCompact } = useResponsiveLayout();
  const numColumns = getPosterColumns(contentWidth);
  const gutter = isCompact ? COMPACT_LIST_GUTTER : WIDE_LIST_GUTTER;
  // The web stack card is only `min-height: 100%`, so without a fixed height the page grows to
  // fit the whole list and the FlatList never gets a viewport to scroll in.
  const screenWebStyle: ViewStyle | null =
    Platform.OS === "web" ? { overflow: "hidden", height, maxHeight: height } : null;
  const movieListStyle: ViewStyle =
    Platform.OS === "web"
      ? { flex: 1, flexShrink: 1, minHeight: 0, height: "100%" }
      : styles.movieList;

  const [categoryKey, setCategoryKey] = useState<keyof typeof DISCOVER_CATEGORY_BY_KEY>("NOW");

  const hasUserScrollIntentRef = useRef(false);

  const {
    data: movieList,
    isPending: isLoading,
    isError,
    error: loadErrorObject,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useDiscoverMoviesInfiniteQuery(categoryKey);

  const loadError = isError ? getDiscoverLoadErrorMessage(loadErrorObject) : null;

  function handleMoviePosterPress(movie: TmdbMovie) {
    blurActiveElementBeforeNavigate();
    navigation.navigate("MovieDetail", { movieId: movie.id });
  }

  const onSelectCategory = (nextCategoryKey: keyof typeof DISCOVER_CATEGORY_BY_KEY) => {
    hasUserScrollIntentRef.current = false;
    setCategoryKey(nextCategoryKey);
  };

  const handleEndReached = () => {
    if (!hasUserScrollIntentRef.current || isLoading || isFetchingNextPage || !hasNextPage) {
      return;
    }

    fetchNextPage();
  };

  return (
    <View style={[styles.screen, screenWebStyle]}>
      <AppShell active="Home">
        <PageHeader title="Discover">
          <View style={styles.tabs} accessibilityRole="tablist">
            {DISCOVER_CATEGORIES.map((category) => {
              const isActive = categoryKey === category.key;

              return (
                <AnimatedPressable
                  key={category.key}
                  contentStyle={[styles.tab, isActive ? styles.tabActive : null]}
                  onPress={() => onSelectCategory(category.key)}
                  accessibilityRole="tab"
                  aria-selected={isActive}
                  testID={category.testId}
                >
                  <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>
                    {category.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </PageHeader>
        <View style={[styles.main, Platform.OS === "web" ? styles.mainWeb : null]}>
          {!movieList && isLoading && <SkeletonGrid numColumns={numColumns} gutter={gutter} />}
          {!movieList && !isLoading && loadError && (
            <View style={styles.centerState} testID="home-error-state">
              <Text style={styles.errorText} accessibilityRole="alert">
                {loadError}
              </Text>
              <AnimatedPressable
                onPress={() => refetch()}
                accessibilityRole="button"
                contentStyle={styles.retryButton}
                testID="home-retry-button"
              >
                <Text style={styles.retryText}>Retry</Text>
              </AnimatedPressable>
            </View>
          )}
          {movieList && (
            <FlatList
              key={`discover-columns-${numColumns}`}
              data={movieList.results}
              style={movieListStyle}
              numColumns={numColumns}
              renderItem={({ item }) => (
                <VerticalMovieCard
                  movie={item}
                  columns={numColumns}
                  onPosterPress={() => handleMoviePosterPress(item)}
                />
              )}
              keyExtractor={(item) => item.id.toString()}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.2}
              contentContainerStyle={[
                styles.content,
                styles.listContent,
                { paddingHorizontal: gutter },
              ]}
              onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
                if (event.nativeEvent.contentOffset.y > 0) {
                  hasUserScrollIntentRef.current = true;
                }
              }}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                hasUserScrollIntentRef.current = true;
              }}
              testID="home-movie-list"
            />
          )}
        </View>
      </AppShell>
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  tabs: {
    flexDirection: "row",
    gap: 24,
  },
  // 11px of padding around the 20px line and the 2px underline makes a 44pt touch target.
  tab: {
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: Theme.colors.gold,
  },
  tabText: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.meta,
    lineHeight: 20,
  },
  tabTextActive: {
    color: Theme.colors.text,
  },
  main: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
    overflow: "hidden",
    justifyContent: "flex-start",
    backgroundColor: Theme.colors.background,
  },
  mainWeb: {
    height: 0,
  },
  movieList: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  content: {
    width: "100%",
    maxWidth: Theme.layout.contentMaxWidth,
    alignSelf: "center",
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  skeletonGrid: {
    paddingTop: 16,
  },
  skeletonRow: {
    flexDirection: "row",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  errorText: {
    color: Theme.colors.danger,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.body,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryText: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.meta,
    lineHeight: 20,
  },
});
