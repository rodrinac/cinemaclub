import { useMovieDetailsQuery } from "@/api/tmdb/queries";
import AnimatedPressable from "@/components/AnimatedPressable";
import AppShell from "@/components/AppShell";
import BackButton from "@/components/BackButton";
import BookmarkButton from "@/components/BookmarkButton";
import MoviePitchCard from "@/components/MoviePitchCard";
import ShareButton from "@/components/ShareButton";
import Theme from "@/theme";
import { BrandArt } from "@/theme/brandArt";
import { useResponsiveLayout } from "@/theme/layout";
import { pickMovieTrailer } from "@/utils/movieTrailer";
import { updateWebSeoMetadata } from "@/utils/seoMeta";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { setStatusBarHidden } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = StaticScreenProps<{
  movieId: number;
}>;

const TRAILER_MIN_LOADING_MS = 250;
const TRAILER_WEB_LOAD_FAILSAFE_MS = 4000;
const WEB_MOVIE_DETAIL_FALLBACK_TITLE = "Cinema Club • Movie";
const WEB_MOVIE_DETAIL_FALLBACK_DESCRIPTION =
  "Explore movie details, ratings, and overviews on Cinema Club.";
const SEO_DESCRIPTION_MAX_LENGTH = 200;
const HERO_ASPECT_RATIO = 16 / 9;
const HERO_MAX_HEIGHT = 420;
const POSTER_COLUMN_WIDTH = 280;
const CAST_LIMIT = 8;

const hasUsableTmdbImagePath = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const formatReleaseYear = (releaseDate: string | undefined) => {
  const year = Number.parseInt(releaseDate?.slice(0, 4) ?? "", 10);

  return Number.isFinite(year) && year > 0 ? String(year) : undefined;
};

const formatRuntime = (totalMinutes: number | undefined) => {
  const minutes = Math.round(totalMinutes ?? 0);

  if (minutes <= 0) {
    return undefined;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
};

const MovieDetail = ({ route }: Props) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height, isCompact, isWide } = useResponsiveLayout();
  // The web stack card is only `min-height: 100%`, so without a fixed height the page grows to
  // fit all of the content and the ScrollView never gets a viewport to scroll in.
  const screenWebStyle =
    Platform.OS === "web" ? { overflow: "hidden" as const, height, maxHeight: height } : null;

  const movieId = route.params.movieId;
  const isValidMovieId = Number.isInteger(movieId) && movieId > 0;
  const {
    data: movie,
    isPending: isMovieQueryPending,
    isError: isMovieQueryError,
  } = useMovieDetailsQuery(movieId);
  const isLoading = isValidMovieId && isMovieQueryPending;
  const loadError = !isValidMovieId
    ? "Invalid movie link."
    : isMovieQueryError
      ? "Could not load this movie."
      : null;
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isTrailerLoading, setIsTrailerLoading] = useState(false);
  const [trailerLoadError, setTrailerLoadError] = useState<string | null>(null);
  const trailerOpenAtRef = useRef(0);
  const trailerLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trailerLoadFailSafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const focusedElementBeforeTrailerRef = useRef<HTMLElement | null>(null);
  const restoreFocusAnimationFrameRef = useRef<number | undefined>(undefined);
  const playTrailerButtonRef = useRef<HTMLButtonElement | null>(null);
  const trailerCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasOpenedTrailerRef = useRef(false);
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  const movieTrailer = useMemo(() => pickMovieTrailer(movie?.videos?.results), [movie]);

  useEffect(() => {
    setStatusBarHidden(true, "slide");

    return () => setStatusBarHidden(false, "fade");
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    if (!movie) {
      updateWebSeoMetadata({
        title: WEB_MOVIE_DETAIL_FALLBACK_TITLE,
        description: WEB_MOVIE_DETAIL_FALLBACK_DESCRIPTION,
      });
      return;
    }

    const description = movie.overview
      ? movie.overview.slice(0, SEO_DESCRIPTION_MAX_LENGTH)
      : WEB_MOVIE_DETAIL_FALLBACK_DESCRIPTION;
    const ogImagePath = movie.poster_path ?? movie.backdrop_path;

    updateWebSeoMetadata({
      title: `Cinema Club • ${movie.title}`,
      description,
      image: ogImagePath ? `https://image.tmdb.org/t/p/w780${ogImagePath}` : undefined,
      type: "video.movie",
    });
  }, [movie]);

  const trailerEmbedUrl = movieTrailer
    ? `https://www.youtube.com/embed/${movieTrailer.key}?autoplay=1&playsinline=1&fs=1`
    : undefined;
  const trailerWatchUrl = movieTrailer
    ? `https://www.youtube.com/watch?v=${movieTrailer.key}`
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
    setTrailerLoadError("Trailer failed to load. You can close the player and try again.");
  };

  const closeTrailer = useCallback(() => {
    clearTrailerLoadingTimers();
    setIsTrailerOpen(false);
    setIsTrailerLoading(false);
    setTrailerLoadError(null);
  }, [clearTrailerLoadingTimers]);

  const playTrailer = () => {
    if (!trailerEmbedUrl || !trailerWatchUrl) {
      return;
    }

    if (Platform.OS === "web") {
      focusedElementBeforeTrailerRef.current =
        playTrailerButtonRef.current ?? (document.activeElement as HTMLElement | null);
      focusedElementBeforeTrailerRef.current?.blur();
      trailerOpenAtRef.current = Date.now();
      setIsTrailerLoading(true);
      setTrailerLoadError(null);
      setIsTrailerOpen(true);
      clearTrailerLoadingTimers();
      trailerLoadFailSafeTimeoutRef.current = setTimeout(() => {
        handleTrailerIframeFailure();
      }, TRAILER_WEB_LOAD_FAILSAFE_MS);
      // The player opens in the hero band, which can be far above this button.
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }

    WebBrowser.openBrowserAsync(trailerWatchUrl);
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
      hasOpenedTrailerRef.current = true;

      const focusInPlayer = requestAnimationFrame(() => {
        trailerCloseButtonRef.current?.focus();
      });

      return () => {
        cancelAnimationFrame(focusInPlayer);
      };
    }

    // The play button sits below the fold on wide screens, so focusing it on mount would
    // scroll the page; there is nothing to restore until the player has been opened once.
    if (!hasOpenedTrailerRef.current) {
      return;
    }

    let attempts = 0;

    const restoreFocus = () => {
      const previousFocusTarget = focusedElementBeforeTrailerRef.current;
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
      focusedElementBeforeTrailerRef.current = null;
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

  const renderInShell = (children: React.ReactNode) => (
    <View style={[styles.screen, screenWebStyle]}>
      <AppShell active="Home">{children}</AppShell>
    </View>
  );

  if (isLoading) {
    return renderInShell(
      <View style={styles.centerState} testID="movie-detail-loading-state">
        <ActivityIndicator color={Theme.colors.gold} size="large" />
        <Text style={styles.loadingMessage}>Loading movie details...</Text>
      </View>,
    );
  }

  if (loadError || !movie) {
    return renderInShell(
      <View style={styles.centerState} testID="movie-detail-error-state">
        <Text style={styles.errorMessage}>{loadError || "Movie details unavailable."}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          accessibilityRole="button"
          style={styles.backHomeButton}
          testID="movie-detail-back-home"
        >
          <Text style={styles.backHomeText}>Back to discover</Text>
        </TouchableOpacity>
      </View>,
    );
  }

  const gutter = isCompact ? 20 : 32;

  // The band is 16:9 at every width, so it always prefers the landscape backdrop.
  const heroImageSize = "w780";
  const preferredHeroPath = movie.backdrop_path;
  const fallbackHeroPath = movie.poster_path;
  const heroImagePath = hasUsableTmdbImagePath(preferredHeroPath)
    ? preferredHeroPath
    : hasUsableTmdbImagePath(fallbackHeroPath)
      ? fallbackHeroPath
      : undefined;
  const heroImageSource = heroImagePath
    ? { uri: `https://image.tmdb.org/t/p/${heroImageSize}${heroImagePath}` }
    : undefined;
  const posterSource = hasUsableTmdbImagePath(movie.poster_path)
    ? { uri: `https://image.tmdb.org/t/p/w342${movie.poster_path}` }
    : undefined;

  const genres = movie.genres ?? [];
  const directors = (movie.credits?.crew ?? [])
    .filter((member) => member.job === "Director")
    .map((member) => member.name);
  const cast = (movie.credits?.cast ?? []).slice(0, CAST_LIMIT);
  const metaLine = [
    formatReleaseYear(movie.release_date),
    formatRuntime(movie.runtime),
    directors.length > 0 ? `Directed by ${directors.join(", ")}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const trailerButton = movieTrailer ? (
    Platform.OS === "web" ? (
      React.createElement(
        "button",
        {
          ref: playTrailerButtonRef,
          onClick: playTrailer,
          type: "button",
          "aria-label": "Watch trailer",
          "data-testid": "play-trailer-button",
          style: styles.webTrailerButton as never,
        },
        <Ionicons name="play" size={20} color={Theme.colors.onGold} aria-hidden />,
        "Watch trailer",
      )
    ) : (
      <AnimatedPressable
        style={styles.trailerButton}
        contentStyle={styles.trailerButtonContent}
        onPress={playTrailer}
        accessibilityRole="button"
        accessibilityLabel="Watch trailer"
        testID="play-trailer-button"
      >
        <Ionicons name="play" size={20} color={Theme.colors.onGold} />
        <Text style={styles.trailerButtonLabel}>Watch trailer</Text>
      </AnimatedPressable>
    )
  ) : null;

  const hero = (
    <View style={styles.hero} testID="movie-detail-hero">
      {heroImageSource ? (
        <Image
          source={heroImageSource}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessible={false}
        />
      ) : (
        <Image
          source={BrandArt.bannerPlaceholder}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessible={false}
          testID="movie-detail-hero-placeholder"
        />
      )}
      {Platform.OS === "web" && isTrailerOpen && (
        <View
          style={styles.trailerPlayer}
          role="region"
          aria-label="Trailer player"
          testID="trailer-inline-player"
        >
          {React.createElement(
            "button",
            {
              ref: trailerCloseButtonRef,
              onClick: closeTrailer,
              type: "button",
              "aria-label": "Close trailer",
              "data-testid": "trailer-player-close",
              style: styles.webTrailerCloseButton as never,
            },
            <Ionicons name="close" size={22} color={Theme.colors.text} />,
          )}
          <View style={styles.trailerFrameContainer}>
            {trailerEmbedUrl &&
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              React.createElement("iframe" as any, {
                src: trailerEmbedUrl,
                style: { width: "100%", height: "100%", border: "none" },
                allow:
                  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
                allowFullScreen: true,
                onLoad: handleTrailerIframeReady,
                onError: handleTrailerIframeFailure,
                title: "Trailer",
              })}
          </View>
          {isTrailerLoading && (
            <View style={styles.trailerLoading} testID="trailer-player-loading">
              <ActivityIndicator color={Theme.colors.gold} size="large" />
              <Text style={styles.trailerLoadingText}>Loading trailer...</Text>
            </View>
          )}
          {!isTrailerLoading && trailerLoadError && (
            <View style={styles.trailerError} testID="trailer-player-error">
              <Text style={styles.trailerErrorText}>{trailerLoadError}</Text>
              <TouchableOpacity
                onPress={closeTrailer}
                accessibilityRole="button"
                style={styles.trailerErrorClose}
                testID="trailer-player-error-close"
              >
                <Text style={styles.trailerErrorCloseText}>Close trailer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const details = (
    <View style={styles.details}>
      <View style={styles.titleBlock}>
        <Text
          style={[
            styles.title,
            isWide
              ? { fontSize: Theme.type.displayLarge, lineHeight: 40 }
              : { fontSize: Theme.type.display, lineHeight: 32 },
          ]}
          accessibilityRole="header"
          testID="movie-detail-title"
        >
          {movie.title}
        </Text>
        {metaLine.length > 0 && (
          <Text style={styles.meta} testID="movie-detail-meta">
            {metaLine}
          </Text>
        )}
      </View>
      <Text style={styles.ratingValue} testID="movie-detail-rating">
        {movie.vote_average.toFixed(1)}
        <Text style={styles.ratingScale}> /10 TMDB</Text>
      </Text>
      {genres.length > 0 && (
        <View style={styles.chips} role="list" testID="movie-detail-genres">
          {genres.map((genre) => (
            <View key={genre.id} style={styles.chip} role="listitem">
              <Text style={styles.chipLabel}>{genre.name}</Text>
            </View>
          ))}
        </View>
      )}
      {!isWide && trailerButton}
      {movie.overview ? (
        <Text style={styles.overview} testID="movie-detail-overview">
          {movie.overview}
        </Text>
      ) : null}
      <MoviePitchCard movieId={movie.id} />
      {cast.length > 0 && (
        <View style={styles.castSection} testID="movie-detail-cast">
          <Text style={styles.sectionLabel}>Cast</Text>
          <View style={styles.castList} role="list">
            {cast.map((member) => (
              <View
                key={member.credit_id}
                style={[styles.castItem, { width: isCompact ? "100%" : "50%" }]}
                role="listitem"
              >
                <Text style={styles.castName}>{member.name}</Text>
                {member.character ? (
                  <Text style={styles.castCharacter}>{member.character}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return renderInShell(
    <>
      <View style={[styles.topBar, { paddingTop: insets.top + (isWide ? 20 : 8) }]}>
        <View style={[styles.topBarInner, { paddingHorizontal: gutter }]}>
          <BackButton testID="movie-detail-back-button" />
          {!isWide && (
            <View style={styles.topBarActions}>
              <ShareButton
                movie={movie}
                size={22}
                style={styles.topBarShare}
                testID="movie-detail-share-button"
              />
              <BookmarkButton
                movie={movie}
                size={24}
                style={styles.topBarBookmark}
                testID="movie-detail-bookmark-button"
              />
            </View>
          )}
        </View>
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.page, { paddingHorizontal: gutter }]}>
          {hero}
          {isWide ? (
            <View style={styles.columns}>
              <View style={styles.sideColumn}>
                {posterSource ? (
                  <Image
                    source={posterSource}
                    style={styles.poster}
                    resizeMode="cover"
                    accessible={false}
                    testID="movie-detail-poster"
                  />
                ) : (
                  <Image
                    source={BrandArt.posterPlaceholder}
                    style={styles.poster}
                    resizeMode="cover"
                    accessible={false}
                  />
                )}
                <View style={styles.actions}>
                  {trailerButton && <View style={styles.actionPrimary}>{trailerButton}</View>}
                  <ShareButton
                    movie={movie}
                    size={22}
                    style={styles.saveButton}
                    testID="movie-detail-share-button"
                  />
                  <BookmarkButton
                    movie={movie}
                    size={24}
                    style={styles.saveButton}
                    testID="movie-detail-bookmark-button"
                  />
                </View>
              </View>
              <View style={styles.mainColumn}>{details}</View>
            </View>
          ) : (
            <View style={styles.singleColumn}>{details}</View>
          )}
        </View>
      </ScrollView>
    </>,
  );
};

export default MovieDetail;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  topBar: {
    backgroundColor: Theme.colors.background,
  },
  topBarInner: {
    width: "100%",
    maxWidth: Theme.layout.contentMaxWidth,
    alignSelf: "center",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  topBarShare: {
    marginVertical: -10,
  },
  // Pulls the 44pt touch target out so the icon lines up with the content edge.
  topBarBookmark: {
    margin: -10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  page: {
    width: "100%",
    maxWidth: Theme.layout.contentMaxWidth,
    alignSelf: "center",
    paddingTop: 12,
  },
  // Art is framed, never full-bleed, and nothing is ever drawn on top of it
  // except the trailer player, which covers the band with an identical box.
  hero: {
    width: "100%",
    aspectRatio: HERO_ASPECT_RATIO,
    maxHeight: HERO_MAX_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.surface,
  },
  singleColumn: {
    paddingTop: 20,
  },
  columns: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 40,
    paddingTop: 32,
  },
  sideColumn: {
    width: POSTER_COLUMN_WIDTH,
    gap: 16,
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
  },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: Theme.colors.surface,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionPrimary: {
    flex: 1,
  },
  // Narrower than tall so "Watch trailer" still fits on one line beside share and save.
  saveButton: {
    width: 48,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Theme.colors.surfaceAlt,
  },
  details: {
    gap: 20,
  },
  titleBlock: {
    gap: 6,
  },
  title: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.display,
  },
  meta: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.meta,
  },
  ratingValue: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.display,
    fontVariant: ["tabular-nums"],
  },
  ratingScale: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.meta,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: Theme.colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipLabel: {
    color: Theme.colors.accentLighter,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.caption,
  },
  trailerButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  trailerButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Theme.colors.gold,
  },
  trailerButtonLabel: {
    color: Theme.colors.onGold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.body,
  },
  // Plain DOM <button> (web only), so these must stay valid CSS rather than RN-only styles.
  webTrailerButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    minHeight: 52,
    paddingTop: 0,
    paddingBottom: 0,
    // Shares the 280px poster column with the share and save buttons.
    paddingLeft: 12,
    paddingRight: 12,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: Theme.colors.gold,
    color: Theme.colors.onGold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.body,
    cursor: "pointer",
  },
  overview: {
    maxWidth: Theme.layout.readingMaxWidth,
    color: Theme.colors.accentLighter,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.body,
    lineHeight: 26,
  },
  castSection: {
    gap: 12,
    maxWidth: Theme.layout.readingMaxWidth,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.border,
  },
  sectionLabel: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.label,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  castList: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
  },
  castItem: {
    paddingRight: 16,
  },
  castName: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.meta,
  },
  castCharacter: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
  },
  trailerPlayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 4,
    backgroundColor: Theme.colors.primaryDarker,
  },
  trailerFrameContainer: {
    flex: 1,
  },
  trailerLoading: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: Theme.colors.overlay,
  },
  trailerLoadingText: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.meta,
  },
  trailerError: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 24,
    backgroundColor: Theme.colors.overlay,
  },
  trailerErrorText: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.meta,
    textAlign: "center",
  },
  trailerErrorClose: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  trailerErrorCloseText: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.meta,
  },
  // Plain DOM <button> (web only), so these must stay valid CSS rather than RN-only styles.
  webTrailerCloseButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    padding: 0,
    borderWidth: 0,
    borderRadius: 22,
    backgroundColor: Theme.colors.overlay,
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
  loadingMessage: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.meta,
    textAlign: "center",
  },
  errorMessage: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.display,
    fontSize: Theme.type.title,
    textAlign: "center",
  },
  backHomeButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  backHomeText: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.meta,
  },
});
