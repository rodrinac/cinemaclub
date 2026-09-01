import { getDiscoverMovies, TmdbMovie, TmdbMovieList } from "@/api/tmdb";
import FooterBar, { FOOTER_BAR_BASE_HEIGHT } from "@/components/FooterBar";
import VerticalMovieCard from "@/components/VerticalMovieCard";
import Theme from "@/theme";
import { mergeUniqueMovies } from "@/utils/movieList";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DISCOVER_CATEGORIES,
  DISCOVER_CATEGORY_BY_KEY,
} from "./discoverCategories";

type PageToLoad = {
  number: number;
  categoryKey: keyof typeof DISCOVER_CATEGORY_BY_KEY;
};

const Home = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = width >= 1200 ? 4 : width >= 768 || isLandscape ? 3 : 2;
  const titleBaseSize = isLandscape ? 24 : 32;
  const footerOffset = FOOTER_BAR_BASE_HEIGHT + insets.bottom + 24;

  const [movieList, setMovieList] = useState<TmdbMovieList>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageToLoad, setPageToLoad] = useState<PageToLoad>({
    number: 1,
    categoryKey: "POPULAR",
  });

  const requestIdRef = useRef(0);
  const isFetchingNextPageRef = useRef(false);
  const hasUserScrollIntentRef = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const titleOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const titleHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [60, 0],
    extrapolate: "clamp",
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [titleBaseSize, 18],
    extrapolate: "clamp",
  });

  useEffect(() => {
    const requestDiscoverMovies = async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);
      setLoadError(null);

      try {
        const category = DISCOVER_CATEGORY_BY_KEY[pageToLoad.categoryKey];
        const response = await getDiscoverMovies(category.key, pageToLoad.number);

        if (requestId !== requestIdRef.current) {
          return;
        }

        const responseData = response.data;
        const loadedMovies = responseData.results;

        setMovieList((prevMovieList) => {
          const currentMovieList = pageToLoad.number === 1 ? [] : prevMovieList?.results || [];
          return {
            ...responseData,
            results: mergeUniqueMovies(currentMovieList, loadedMovies),
          };
        });
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setLoadError("Could not load discover movies. Please try again.");
      } finally {
        if (requestId === requestIdRef.current) {
          isFetchingNextPageRef.current = false;
          setIsLoading(false);
        }
      }
    };

    requestDiscoverMovies();
  }, [pageToLoad]);

  function handleMoviePosterPress(movie: TmdbMovie) {
    navigation.navigate("MovieDetail", { movieId: movie.id });
  }

  const onSelectCategory = (categoryKey: keyof typeof DISCOVER_CATEGORY_BY_KEY) => {
    isFetchingNextPageRef.current = false;
    hasUserScrollIntentRef.current = false;
    setPageToLoad({
      number: 1,
      categoryKey,
    });
  };

  const handleEndReached = () => {
    if (!hasUserScrollIntentRef.current || isLoading || isFetchingNextPageRef.current || !movieList) {
      return;
    }

    if (movieList.page >= movieList.total_pages) {
      return;
    }

    isFetchingNextPageRef.current = true;
    setPageToLoad((currentPage) => ({
      ...currentPage,
      number: currentPage.number + 1,
    }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Animated.View
          style={[
            styles.titleWrapper,
            {
              height: titleHeight,
              opacity: titleOpacity,
            },
          ]}
        >
          <Animated.Text style={[styles.title, { fontSize: titleScale }]}>DISCOVER</Animated.Text>
        </Animated.View>

        <View style={styles.menu}>
          {DISCOVER_CATEGORIES.map((category) => {
            const isActive = pageToLoad.categoryKey === category.key;

            return (
              <TouchableOpacity
                key={category.key}
                style={styles.menuItem}
                onPress={() => onSelectCategory(category.key)}
                testID={category.testId}
              >
                <Text style={[styles.menuItemText, isActive ? styles.menuItemTextActive : {}]}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.menuItem}> </Text>
        </View>
      </View>
      <View style={styles.main}>
        {!movieList && isLoading && (
          <View style={styles.centerState} testID="home-loading-state">
            <ActivityIndicator color={Theme.colors.warning} size="large" />
            <Text style={styles.helperText}>Loading discover movies...</Text>
          </View>
        )}
        {!movieList && !isLoading && loadError && (
          <View style={styles.centerState} testID="home-error-state">
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity
              onPress={() =>
                setPageToLoad((currentPage) => ({
                  ...currentPage,
                }))
              }
              testID="home-retry-button"
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {movieList && (
          <Animated.FlatList
            key={`discover-columns-${numColumns}`}
            data={movieList.results}
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
            contentContainerStyle={[styles.movieListContent, { paddingBottom: footerOffset }]}
            scrollIndicatorInsets={{ bottom: footerOffset }}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
              listener: (event) => {
                if (event.nativeEvent.contentOffset.y > 0) {
                  hasUserScrollIntentRef.current = true;
                }
              },
            })}
            onScrollBeginDrag={() => {
              hasUserScrollIntentRef.current = true;
            }}
            testID="home-movie-list"
          />
        )}
      </View>
      <FooterBar />
    </KeyboardAvoidingView>
  );
};

export default Home;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    backgroundColor: Theme.colors.primary,
    elevation: 2,
  },
  titleWrapper: {
    position: "relative",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
  },
  title: {
    color: Theme.colors.accent,
    fontFamily: "RobotoCondensed_700Bold",
  },
  main: {
    flex: 1,
    justifyContent: "flex-start",
    backgroundColor: Theme.colors.background,
    paddingTop: 8,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  helperText: {
    color: Theme.colors.accentLighter,
  },
  errorText: {
    color: Theme.colors.danger,
    textAlign: "center",
  },
  retryText: {
    color: Theme.colors.warning,
    fontWeight: "bold",
  },
  movieListContent: {
    paddingHorizontal: 6,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: Theme.colors.primary,
    elevation: 2,
  },
  footerNavItem: {
    margin: 12,
  },
  menu: {
    marginVertical: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
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
});
