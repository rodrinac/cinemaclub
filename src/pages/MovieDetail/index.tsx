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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = StaticScreenProps<{
  movieId: number;
}>;

const MovieDetail = ({ route }: Props) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const movieId = route.params.movieId;
  const [movie, setMovie] = useState<TmdbMovie>();
  const [bookmarked, setBookmarked] = useState<boolean>();
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

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
      const response = await api.get<TmdbMovie>(`movies/${movieId}`, {
        params: { append_to_response: "videos" },
      });

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

  const trailerUrl = movieTrailer
    ? `https://www.youtube.com/embed/${movieTrailer.key}?autoplay=1&fs=1`
    : undefined;

  const playTrailer = () => {
    if (!trailerUrl) {
      return;
    }

    if (Platform.OS === "web") {
      setIsTrailerOpen(true);
      return;
    }

    WebBrowser.openBrowserAsync(trailerUrl);
  };

  useEffect(() => {
    if (!(Platform.OS === "web" && isTrailerOpen)) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTrailerOpen(false);
      }
    };

    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [isTrailerOpen]);

  if (!movie) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ImageBackground
        style={[styles.container, { paddingTop: insets.top + 8 }]}
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
            <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
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
          <Text style={[styles.title, { fontSize: isLandscape ? 36 : 48 }]}>{movie.title.toUpperCase()}</Text>
          <Text style={styles.overview}>{movie.overview}</Text>
          <View style={styles.play}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={playTrailer}
              accessibilityLabel="Play trailer"
              testID="play-trailer-button"
            >
              <Ionicons name="play-sharp" color={Theme.colors.primaryDarker} size={24} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ImageBackground>
      <Modal
        visible={Platform.OS === "web" && isTrailerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTrailerOpen(false)}
      >
        <Pressable style={styles.trailerBackdrop} onPress={() => setIsTrailerOpen(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={styles.trailerPanel}
            testID="trailer-overlay"
          >
            <TouchableOpacity
              style={styles.trailerCloseButton}
              onPress={() => setIsTrailerOpen(false)}
              accessibilityLabel="Close trailer"
              testID="trailer-overlay-close"
            >
              <Ionicons name="close" size={22} color={Theme.colors.accent} />
            </TouchableOpacity>
            {trailerUrl ? (
              Platform.OS === "web" ? (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                React.createElement("iframe" as any, {
                  src: trailerUrl,
                  style: { width: "100%", height: "100%", border: "none" },
                  allow:
                    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
                  allowFullScreen: true,
                  title: "Trailer",
                })
              ) : null
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
    fontWeight: "bold",
    fontFamily: "RobotoCondensed_700Bold",
    maxWidth: 680,
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
    color: Theme.colors.textMuted,
    maxWidth: 760,
  },
  play: {
    alignItems: "center",
    paddingTop: 24,
  },
  playButton: {
    backgroundColor: Theme.colors.warning,
    borderRadius: 24,
    padding: 18,
  },
  trailerBackdrop: {
    flex: 1,
    backgroundColor: Theme.colors.backdrop,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  trailerPanel: {
    width: "100%",
    maxWidth: 1080,
    aspectRatio: 16 / 9,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Theme.colors.surfaceAlt,
  },
  trailerCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: Theme.colors.overlay,
    borderRadius: 20,
    padding: 6,
  },
});
