import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  KeyboardAvoidingView,
  ImageBackground,
  Platform,
  Text,
  View,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { TouchableOpacity, ScrollView } from "react-native-gesture-handler";
import { Feather, Entypo, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";

import api, { TmdbMovie } from "../../api/tmdb";
import Theme from "../../theme";
import { hasBookmark, addBookmark, removeBookmark } from "../../api/database";

interface Params {
  movieId: number;
}

const MovieDetail = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const routeParams = route.params as Params;

  const [movie, setMovie] = useState<TmdbMovie>();
  const [bookmarked, setBookmarked] = useState<boolean>();

  useEffect(() => {
    const requestMovieDetail = async () => {
      const response = await api.get<TmdbMovie>(
        `movie/${routeParams.movieId}?append_to_response=videos`,
      );

      setMovie(response.data);
    };

    requestMovieDetail();
  }, [routeParams.movieId]);

  useEffect(() => {
    (async () => {
      setBookmarked(
        await hasBookmark({ id: routeParams.movieId } as TmdbMovie),
      );
    })();
  }, [routeParams.movieId]);

  const changeBookmarkStatus = async () => {
    if (bookmarked) {
      await removeBookmark(movie!);
    } else {
      await addBookmark(movie!);
    }

    setBookmarked(!bookmarked);
  };

  function getReleaseYear(): number {
    const releaseDate = new Date(movie!.release_date);

    return releaseDate.getFullYear();
  }

  function handlePlayTrailer() {
    const movieTrailer = movie!.videos?.results.find((video) =>
      /youtube/i.test(video.site),
    );

    if (movieTrailer) {
      WebBrowser.openBrowserAsync(
        `https://www.youtube.com/embed/${movieTrailer.key}?rel=0&autoplay=0&showinfo=0&controls=0`,
      );
    }
  }

  if (!movie) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ImageBackground
        style={styles.container}
        source={{ uri: `https://image.tmdb.org/t/p/w500${movie.poster_path}` }}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["transparent", Theme.colors.primary]}
          start={[0.0, 0.1]}
          style={styles.linearGradient}
        />
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={changeBookmarkStatus}>
            <Ionicons
              name="bookmark"
              color={bookmarked ? "#ffd700" : "#FFF"}
              size={24}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }}>
          <Text style={styles.yearAndGenre}>
            {getReleaseYear()} • {movie.genres[0]?.name || "?"}
          </Text>
          <View style={styles.rating}>
            <Text style={styles.ratingOwned}>{movie.vote_average} </Text>
            <Text style={styles.ratingBase}>/ 10</Text>
            <Text style={styles.ratingProvider}> IMDb</Text>
          </View>
          <Text style={styles.title}>{movie.title.toUpperCase()}</Text>
          <Text style={styles.overview}>{movie.overview}</Text>
          <View style={styles.play}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayTrailer}
            >
              <Entypo name="controller-play" color="#2e2a19" size={24} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ImageBackground>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerNavItem}
          onPress={() => navigation.navigate("Settings")}
        >
          <Feather name="grid" color="#fff" size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerNavItem}
          onPress={() => navigation.navigate("SearchMovie")}
        >
          <Feather name="search" color="#fff" size={24} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default MovieDetail;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    justifyContent: "flex-end",
  },
  linearGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "100%",
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    flex: 1,
  },
  yearAndGenre: {
    color: "#fff",
  },
  title: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_700Bold",
    maxWidth: 360,
  },
  rating: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  ratingOwned: {
    color: "#fff",
    fontWeight: "bold",
  },
  ratingBase: {
    color: "#f1f1f1",
    fontWeight: "100",
    fontSize: 12,
  },
  ratingProvider: {
    color: "#ffd700",
    fontWeight: "bold",
  },
  overview: {
    color: "#fff",
  },
  play: {
    alignItems: "center",
    paddingTop: 24,
  },
  playButton: {
    backgroundColor: "#ffd700",
    borderRadius: 24,
    padding: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: Theme.colors.primary,
  },
  footerNavItem: {
    margin: 12,
  },
});
