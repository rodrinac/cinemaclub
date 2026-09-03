import { addBookmark, hasBookmark, removeBookmark } from "@/api/database";
import api, { TmdbMovie } from "@/api/tmdb";
import AnimatedPressable from "@/components/AnimatedPressable";
import FooterBar from "@/components/FooterBar";
import Theme from "@/theme";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { setStatusBarHidden } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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

const TRAILER_MIN_LOADING_MS = 250;
const TRAILER_WEB_LOAD_FAILSAFE_MS = 4000;
const WEB_MOVIE_DETAIL_FALLBACK_TITLE = "Cinema Club • Movie";
const MOVIE_DETAIL_LARGE_VIEWPORT_WIDTH = 768;

const hasUsableTmdbImagePath = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const MovieDetail = ({ route }: Props) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const movieId = route.params.movieId;
  const [movie, setMovie] = useState<TmdbMovie>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState<boolean>();
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isTrailerLoading, setIsTrailerLoading] = useState(false);
  const [trailerLoadError, setTrailerLoadError] = useState<string | null>(null);
  const trailerOpenAtRef = useRef(0);
  const trailerLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trailerLoadFailSafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusedElementBeforeModalRef = useRef<HTMLElement | null>(null);
  const restoreFocusAnimationFrameRef = useRef<number | undefined>(undefined);
  const playTrailerButtonRef = useRef<HTMLButtonElement | null>(null);
  const trailerCloseButtonRef = useRef<HTMLButtonElement | null>(null);

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
      if (!Number.isInteger(movieId) || movieId < 1) {
        setMovie(undefined);
        setLoadError("Invalid movie link.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setMovie(undefined);
        setLoadError(null);
        const response = await api.get<TmdbMovie>(`movies/${movieId}`, {
          params: { append_to_response: "videos" },
        });

        setMovie(response.data);
      } catch {
        setMovie(undefined);
        setLoadError("Could not load this movie.");
      } finally {
        setIsLoading(false);
      }
    };

    requestMovieDetail();
  }, [movieId]);

  useEffect(() => {
    (async () => {
      setBookmarked(await hasBookmark({ id: movieId }));
    })();
  }, [movieId]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    document.title = movie?.title ? `Cinema Club • ${movie.title}` : WEB_MOVIE_DETAIL_FALLBACK_TITLE;
  }, [movie?.title]);

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

  const clearTrailerLoadingTimers = useCallback(() => {
    if (trailerLoadingTimeoutRef.current) {
      clearTimeout(trailerLoadingTimeoutRef.current);
      trailerLoadingTimeoutRef.current = undefined;
    }

    if (trailerLoadFailSafeTimeoutRef.current) {
      clearTimeout(trailerLoadFailSafeTimeoutRef.current);
      trailerLoadFailSafeTimeoutRef.current = undefined;
    }
  }, []);

  const handleTrailerIframeReady = () => {
    clearTrailerLoadingTimers();
    setTrailerLoadError(null);
    const elapsedMs = Date.now() - trailerOpenAtRef.current;
    const remainingLoadingMs = Math.max(0, TRAILER_MIN_LOADING_MS - elapsedMs);

    if (remainingLoadingMs === 0) {
      setIsTrailerLoading(false);
      return;
    }

    trailerLoadingTimeoutRef.current = setTimeout(() => {
      setIsTrailerLoading(false);
      trailerLoadingTimeoutRef.current = undefined;
    }, remainingLoadingMs);
  };

  const handleTrailerIframeFailure = () => {
    clearTrailerLoadingTimers();
    setIsTrailerLoading(false);
    setTrailerLoadError("Trailer failed to load. You can close this overlay and try again.");
  };

  const closeTrailer = useCallback(() => {
    clearTrailerLoadingTimers();
    setIsTrailerOpen(false);
    setIsTrailerLoading(false);
    setTrailerLoadError(null);
  }, [clearTrailerLoadingTimers]);

  const playTrailer = () => {
    if (!trailerUrl) {
      return;
    }

    if (Platform.OS === "web") {
      focusedElementBeforeModalRef.current =
        playTrailerButtonRef.current ?? (document.activeElement as HTMLElement | null);
      focusedElementBeforeModalRef.current?.blur();
      trailerOpenAtRef.current = Date.now();
      setIsTrailerLoading(true);
      setTrailerLoadError(null);
      setIsTrailerOpen(true);
      clearTrailerLoadingTimers();
      trailerLoadFailSafeTimeoutRef.current = setTimeout(() => {
        handleTrailerIframeFailure();
      }, TRAILER_WEB_LOAD_FAILSAFE_MS);
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
        closeTrailer();
      }
    };

    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [closeTrailer, isTrailerOpen]);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    if (restoreFocusAnimationFrameRef.current !== undefined) {
      cancelAnimationFrame(restoreFocusAnimationFrameRef.current);
      restoreFocusAnimationFrameRef.current = undefined;
    }

    if (isTrailerOpen) {
      const focusInModal = requestAnimationFrame(() => {
        trailerCloseButtonRef.current?.focus();
      });

      return () => {
        cancelAnimationFrame(focusInModal);
      };
    }

    let attempts = 0;

    const restoreFocus = () => {
      const previousFocusTarget = focusedElementBeforeModalRef.current;
      const focusTarget =
        previousFocusTarget && previousFocusTarget.isConnected
          ? previousFocusTarget
          : playTrailerButtonRef.current;

      if (!focusTarget) {
        return;
      }

      const hiddenAncestor = focusTarget.closest('[aria-hidden="true"]');

      if (hiddenAncestor && attempts < 8) {
        attempts += 1;
        restoreFocusAnimationFrameRef.current = requestAnimationFrame(restoreFocus);
        return;
      }

      focusTarget.focus();
      focusedElementBeforeModalRef.current = null;
      restoreFocusAnimationFrameRef.current = undefined;
    };

    restoreFocusAnimationFrameRef.current = requestAnimationFrame(restoreFocus);

    return () => {
      if (restoreFocusAnimationFrameRef.current !== undefined) {
        cancelAnimationFrame(restoreFocusAnimationFrameRef.current);
        restoreFocusAnimationFrameRef.current = undefined;
      }
    };
  }, [isTrailerOpen]);

  useEffect(() => {
    return () => {
      if (restoreFocusAnimationFrameRef.current !== undefined) {
        cancelAnimationFrame(restoreFocusAnimationFrameRef.current);
        restoreFocusAnimationFrameRef.current = undefined;
      }

      if (trailerLoadingTimeoutRef.current) {
        clearTimeout(trailerLoadingTimeoutRef.current);
        trailerLoadingTimeoutRef.current = undefined;
      }

      if (trailerLoadFailSafeTimeoutRef.current) {
        clearTimeout(trailerLoadFailSafeTimeoutRef.current);
        trailerLoadFailSafeTimeoutRef.current = undefined;
      }
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centerState} testID="movie-detail-loading-state">
        <ActivityIndicator color={Theme.colors.warning} size="large" />
        <Text style={styles.errorMessage}>Loading movie details...</Text>
      </View>
    );
  }

  if (loadError || !movie) {
    return (
      <View style={styles.centerState} testID="movie-detail-error-state">
        <Text style={styles.errorMessage}>{loadError || "Movie details unavailable."}</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Home")} testID="movie-detail-back-home">
          <Text style={styles.backHomeText}>Back to discover</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isLargeViewport = width >= MOVIE_DETAIL_LARGE_VIEWPORT_WIDTH;
  const heroImageSize = isLargeViewport ? "w780" : "w500";
  const preferredHeroPath = isLargeViewport ? movie.backdrop_path : movie.poster_path;
  const fallbackHeroPath = isLargeViewport ? movie.poster_path : movie.backdrop_path;
  const heroImagePath = hasUsableTmdbImagePath(preferredHeroPath)
    ? preferredHeroPath
    : hasUsableTmdbImagePath(fallbackHeroPath)
      ? fallbackHeroPath
      : undefined;
  const heroImageSource = heroImagePath
    ? { uri: `https://image.tmdb.org/t/p/${heroImageSize}${heroImagePath}` }
    : undefined;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ImageBackground
        style={[styles.container, { paddingTop: insets.top + 8 }]}
        source={heroImageSource}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["transparent", Theme.colors.primary]}
          start={[0.0, 0.1]}
          style={styles.linearGradient}
        />
        <View style={styles.nav}>
          <AnimatedPressable borderless onPress={() => navigation.goBack()} testID="movie-detail-back-button">
            <Ionicons name="arrow-back" size={24} color={Theme.colors.accent} />
          </AnimatedPressable>
          <AnimatedPressable borderless onPress={changeBookmarkStatus}>
            <Ionicons
              name={bookmarked ? "bookmark" : "bookmark-outline"}
              color={Theme.colors.accent}
              size={24}
            />
          </AnimatedPressable>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.yearAndGenre}>
            {getReleaseYear()} • {movie.genres[0]?.name || "?"}
          </Text>
          <View style={styles.rating}>
            <Text style={styles.ratingOwned}>{movie.vote_average.toFixed(1)} </Text>
            <Text style={styles.ratingBase}>/ 10</Text>
            <Text style={styles.ratingProvider}> TMDB</Text>
          </View>
          <Text style={[styles.title, { fontSize: isLandscape ? 36 : 48 }]}>{movie.title.toUpperCase()}</Text>
          <Text style={styles.overview}>{movie.overview}</Text>
          <View style={styles.play}>
            {Platform.OS === "web" ? (
              React.createElement(
                "button",
                {
                  ref: playTrailerButtonRef,
                  onClick: playTrailer,
                  type: "button",
                  "aria-label": "Play trailer",
                  "data-testid": "play-trailer-button",
                  style: styles.webPlayButton as never,
                },
                <Ionicons name="play-sharp" color={Theme.colors.primaryDarker} size={24} />
              )
            ) : (
              <AnimatedPressable
                contentStyle={styles.playButton}
                onPress={playTrailer}
                accessibilityLabel="Play trailer"
                testID="play-trailer-button"
              >
                <Ionicons name="play-sharp" color={Theme.colors.primaryDarker} size={24} />
              </AnimatedPressable>
            )}
          </View>
        </ScrollView>
      </ImageBackground>
      <Modal
        visible={Platform.OS === "web" && isTrailerOpen}
        transparent
        animationType="fade"
        accessibilityViewIsModal
        onRequestClose={closeTrailer}
      >
        <Pressable style={styles.trailerBackdrop} onPress={closeTrailer}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={styles.trailerPanel}
            role={Platform.OS === "web" ? "dialog" : undefined}
            aria-modal={Platform.OS === "web" ? true : undefined}
            aria-label={Platform.OS === "web" ? "Trailer modal" : undefined}
            testID="trailer-overlay"
          >
            <ImageBackground
              source={{ uri: `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` }}
              style={styles.trailerBackdropPreview}
              resizeMode="cover"
            >
              <LinearGradient
                colors={[Theme.colors.overlay, Theme.colors.primaryDarker]}
                start={[0.1, 0.0]}
                style={StyleSheet.absoluteFillObject}
              />
            </ImageBackground>
            {Platform.OS === "web" ? (
              React.createElement(
                "button",
                {
                  ref: trailerCloseButtonRef,
                  onClick: closeTrailer,
                  type: "button",
                  "aria-label": "Close trailer",
                  "data-testid": "trailer-overlay-close",
                  style: styles.webTrailerCloseButton as never,
                },
                <Ionicons name="close" size={22} color={Theme.colors.accent} />
              )
            ) : (
              <AnimatedPressable
                contentStyle={styles.trailerCloseButton}
                onPress={closeTrailer}
                accessibilityLabel="Close trailer"
                testID="trailer-overlay-close"
              >
                <Ionicons name="close" size={22} color={Theme.colors.accent} />
              </AnimatedPressable>
            )}
            <View style={styles.trailerFrameContainer}>
              {trailerUrl
                ? Platform.OS === "web"
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    React.createElement("iframe" as any, {
                      src: trailerUrl,
                      style: { width: "100%", height: "100%", border: "none" },
                      allow:
                        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
                      allowFullScreen: true,
                      onLoad: handleTrailerIframeReady,
                      onError: handleTrailerIframeFailure,
                      title: "Trailer",
                    })
                  : null
                : null}
            </View>
            {isTrailerLoading && (
              <View style={styles.trailerLoading} testID="trailer-overlay-loading">
                <ActivityIndicator color={Theme.colors.warning} size="large" />
                <Text style={styles.trailerLoadingText}>Loading trailer...</Text>
              </View>
            )}
            {!isTrailerLoading && trailerLoadError && (
              <View style={styles.trailerError} testID="trailer-overlay-error">
                <Text style={styles.trailerErrorText}>{trailerLoadError}</Text>
                <TouchableOpacity onPress={closeTrailer} testID="trailer-overlay-error-close">
                  <Text style={styles.trailerErrorCloseText}>Close trailer</Text>
                </TouchableOpacity>
              </View>
            )}
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
  webPlayButton: {
    backgroundColor: Theme.colors.warning,
    borderRadius: 24,
    padding: 18,
    borderWidth: 0,
    cursor: "pointer",
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
  trailerBackdropPreview: {
    ...StyleSheet.absoluteFillObject,
  },
  trailerFrameContainer: {
    flex: 1,
  },
  trailerLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.colors.overlay,
  },
  trailerLoadingText: {
    color: Theme.colors.accent,
    fontWeight: "bold",
  },
  trailerError: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    backgroundColor: Theme.colors.overlay,
  },
  trailerErrorText: {
    color: Theme.colors.accent,
    textAlign: "center",
  },
  trailerErrorCloseText: {
    color: Theme.colors.warning,
    fontWeight: "bold",
  },
  trailerCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 3,
    backgroundColor: Theme.colors.overlay,
    borderRadius: 20,
    padding: 6,
  },
  webTrailerCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 3,
    backgroundColor: Theme.colors.overlay,
    borderRadius: 20,
    padding: 6,
    borderWidth: 0,
    cursor: "pointer",
  },
  centerState: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  errorMessage: {
    color: Theme.colors.accent,
    textAlign: "center",
  },
  backHomeText: {
    color: Theme.colors.warning,
    fontWeight: "bold",
  },
});
