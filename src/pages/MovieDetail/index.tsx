import { addBookmark, hasBookmark, removeBookmark } from "@/api/database";
import api, { TmdbMovie } from "@/api/tmdb";
import FooterBar from "@/components/FooterBar";
import Theme from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarHidden } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScrollView, TouchableOpacity } from "react-native-gesture-handler";

type Props = StaticScreenProps<{
  movieId: number;
}>;

const MovieDetail = ({ route }: Props) => {
  const navigation = useNavigation();

  const movieId = route.params.movieId;
  const [movie, setMovie] = useState<TmdbMovie>();
  const [bookmarked, setBookmarked] = useState<boolean>();

  const movieTrailer = useMemo(() => {
    const videos = movie?.videos?.results ?? [];

    return videos
      .filter((video) => video.type === "Teaser" || video.type === "Trailer")
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .find((video) => /youtube/i.test(video.site));
  }, [movie]);

  useEffect(() => {
    setStatusBarHidden(true, "slide");

    return () => setStatusBarHidden(false, "fade");
  }, []);

  useEffect(() => {
    const requestMovieDetail = async () => {
      const response = await api.get<TmdbMovie>(`movie/${movieId}?append_to_response=videos`);

      setMovie(response.data);
    };

    requestMovieDetail();
  }, [movieId]);

  useEffect(() => {
    (async () => {
      setBookmarked(await hasBookmark({ id: movieId }));
    })();
  }, [movieId]);

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

  const playTrailer = () => {
    if (movieTrailer) {
      WebBrowser.openBrowserAsync(
        `https://www.youtube.com/embed/${movieTrailer.key}?autoplay=1&fs=1`,
      );
    }
  };

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
              name={bookmarked ? "bookmark" : "bookmark-outline"}
              color={Theme.colors.accent}
              size={24}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.yearAndGenre}>
            {getReleaseYear()} • {movie.genres[0]?.name || "?"}
          </Text>
          <View style={styles.rating}>
            <Text style={styles.ratingOwned}>{movie.vote_average} </Text>
            <Text style={styles.ratingBase}>/ 10</Text>
            <Text style={styles.ratingProvider}> TMDB</Text>
          </View>
          <Text style={styles.title}>{movie.title.toUpperCase()}</Text>
          <Text style={styles.overview}>{movie.overview}</Text>
          <View style={styles.play}>
            <TouchableOpacity style={styles.playButton} onPress={playTrailer}>
              <Ionicons name="play-sharp" color={Theme.colors.primaryDarker} size={24} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ImageBackground>
      <FooterBar elevated={false} />
    </KeyboardAvoidingView>
  );
};

export default MovieDetail;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingBottom: 0,
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
    color: Theme.colors.accent,
  },
  title: {
    color: Theme.colors.accent,
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
    color: Theme.colors.accent,
    fontWeight: "bold",
  },
  ratingBase: {
    color: Theme.colors.accentLighter,
    fontWeight: "100",
    fontSize: 12,
  },
  ratingProvider: {
    color: Theme.colors.gold,
    fontWeight: "bold",
  },
  overview: {
    color: Theme.colors.accentLighter,
  },
  play: {
    alignItems: "center",
    paddingTop: 24,
  },
  playButton: {
    backgroundColor: Theme.colors.gold,
    borderRadius: 24,
    padding: 18,
  },
});
