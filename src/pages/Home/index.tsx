import tmdb, { TmdbMovie, TmdbMovieList } from "@/api/tmdb";
import FooterBar from "@/components/FooterBar";
import VerticalMovieCard from "@/components/VerticalMovieCard";
import Theme from "@/theme";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

enum Filter {
  NOW = "movie/now_playing",
  POPULAR = "movie/popular",
  UPCOMMING = "movie/upcoming",
}

interface PageToLoad {
  number: number;
  filter: Filter;
}

const Home = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [movieList, setMovieList] = useState<TmdbMovieList>();
  const [pageToLoad, setPageToLoad] = useState<PageToLoad>({
    number: 1,
    filter: Filter.POPULAR,
  });

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
    outputRange: [32, 8],
    extrapolate: "clamp",
  });

  useEffect(() => {
    const requestDiscoverMovies = async () => {
      const response = await tmdb.get<TmdbMovieList>(pageToLoad.filter, {
        params: { page: pageToLoad.number },
      });

      const responseData = response.data;
      const loadedMovies = responseData.results;

      setMovieList((prevMovieList) => {
        const currentMovieList =
          pageToLoad.number === 1 ? [] : prevMovieList?.results || [];
        return {
          ...responseData,
          results: currentMovieList.concat(loadedMovies),
        };
      });
    };

    requestDiscoverMovies();
  }, [pageToLoad]);

  function handleMoviePosterPress(movie: TmdbMovie) {
    navigation.navigate("MovieDetail", { movieId: movie.id });
  }

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
          <Animated.Text style={[styles.title, { fontSize: titleScale }]}>
            DISCOVER
          </Animated.Text>
        </Animated.View>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem}>
            <Text
              style={[
                styles.menuItemText,
                pageToLoad.filter === Filter.NOW
                  ? styles.menuItemTextActive
                  : {},
              ]}
              onPress={() => setPageToLoad({ number: 1, filter: Filter.NOW })}
            >
              Now
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text
              style={[
                styles.menuItemText,
                pageToLoad.filter === Filter.POPULAR
                  ? styles.menuItemTextActive
                  : {},
              ]}
              onPress={() =>
                setPageToLoad({ number: 1, filter: Filter.POPULAR })
              }
            >
              Popular
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text
              style={[
                styles.menuItemText,
                pageToLoad.filter === Filter.UPCOMMING
                  ? styles.menuItemTextActive
                  : {},
              ]}
              onPress={() =>
                setPageToLoad({ number: 1, filter: Filter.UPCOMMING })
              }
            >
              Upcomming
            </Text>
          </TouchableOpacity>
          <Text style={styles.menuItem}> </Text>
        </View>
      </View>
      <View style={styles.main}>
        {movieList && (
          <Animated.FlatList
            data={movieList.results}
            numColumns={2}
            renderItem={({ item }) => (
              <VerticalMovieCard
                movie={item}
                onPosterPress={() => handleMoviePosterPress(item)}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            onEndReached={() =>
              setPageToLoad({ ...pageToLoad, number: pageToLoad.number + 1 })
            }
            onEndReachedThreshold={0.2}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              {
                useNativeDriver: false,
              },
            )}
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
    paddingLeft: 12,
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
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
    paddingTop: 8,
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
});
