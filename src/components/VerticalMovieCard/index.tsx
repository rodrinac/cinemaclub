import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View, ViewStyle } from "react-native";
import { TmdbMovie } from "../../api/tmdb";
import Theme from "../../theme";
import { BrandArt } from "@/theme/brandArt";
import AnimatedPressable from "../AnimatedPressable";
import BookmarkButton from "../BookmarkButton";

type Props = {
  movie: TmdbMovie;
  onPosterPress?: () => void;
  /** Columns of the surrounding grid, so a short last row keeps the size of the full rows. */
  columns?: number;
};

// FlatList lays rows out as flex rows, so without a cap a short last row would stretch its cards.
const getColumnStyle = (columns?: number): ViewStyle | undefined =>
  columns ? { maxWidth: `${100 / columns}%` } : undefined;

const getReleaseYear = (releaseDate?: string) => {
  const year = releaseDate?.slice(0, 4);

  return year && /^\d{4}$/.test(year) ? year : undefined;
};

// TMDB reports 0 for movies nobody has rated yet, which would read as a terrible score.
const getRating = (voteAverage?: number) =>
  voteAverage && voteAverage > 0 ? voteAverage.toFixed(1) : undefined;

const VerticalMovieCard: React.FC<Props> = ({ movie, onPosterPress, columns }) => {
  const posterSource = movie.poster_path
    ? { uri: `https://image.tmdb.org/t/p/w342${movie.poster_path}` }
    : BrandArt.posterPlaceholder;

  const releaseYear = getReleaseYear(movie.release_date);
  const rating = getRating(movie.vote_average);
  const metaLabel = [releaseYear, rating ? `rated ${rating} out of 10` : undefined]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={[styles.container, getColumnStyle(columns)]}>
      <View>
        <AnimatedPressable
          borderless
          style={styles.posterPressable}
          onPress={onPosterPress}
          accessibilityRole="button"
          accessibilityLabel={movie.title}
          testID={`movie-poster-${movie.id}`}
        >
          <Image
            accessible={false}
            style={styles.poster}
            source={posterSource}
            resizeMode="cover"
          />
        </AnimatedPressable>
        <View style={styles.bookmarkSlot}>
          <View style={styles.bookmarkScrim} />
          <BookmarkButton movie={movie} size={16} />
        </View>
      </View>
      <View style={styles.caption}>
        {/* The poster button already carries the title, so assistive tech skips this copy. */}
        <Text style={styles.title} numberOfLines={2} aria-hidden>
          {movie.title}
        </Text>
        {metaLabel ? (
          <View style={styles.meta} accessible accessibilityLabel={metaLabel}>
            {releaseYear ? <Text style={styles.metaText}>{releaseYear}</Text> : null}
            {releaseYear && rating ? <Text style={styles.metaText}>·</Text> : null}
            {rating ? (
              <View style={styles.rating}>
                <Ionicons name="star" size={12} color={Theme.colors.gold} />
                <Text style={styles.ratingText}>{rating}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default VerticalMovieCard;

/** Poster-shaped placeholder that shares the card's geometry, for loading grids. */
export const VerticalMovieCardSkeleton: React.FC<Pick<Props, "columns">> = ({ columns }) => (
  <View style={[styles.container, getColumnStyle(columns)]}>
    <View style={styles.poster} />
    <View style={styles.caption}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonMeta} />
    </View>
  </View>
);

const BOOKMARK_TOUCH_TARGET = 44;
const BOOKMARK_SCRIM_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    // Half of the 12px gutter between posters. The list's own padding adds the rest of the
    // page margin, so poster edges line up with the page header.
    paddingHorizontal: 6,
    paddingBottom: 18,
  },
  posterPressable: {
    borderRadius: 8,
  },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 8,
    backgroundColor: Theme.colors.surface,
  },
  bookmarkSlot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: BOOKMARK_TOUCH_TARGET,
    height: BOOKMARK_TOUCH_TARGET,
    zIndex: 1,
  },
  // The scrim is smaller than the 44pt touch target, so it sits centered behind the button.
  bookmarkScrim: {
    position: "absolute",
    top: (BOOKMARK_TOUCH_TARGET - BOOKMARK_SCRIM_SIZE) / 2,
    left: (BOOKMARK_TOUCH_TARGET - BOOKMARK_SCRIM_SIZE) / 2,
    width: BOOKMARK_SCRIM_SIZE,
    height: BOOKMARK_SCRIM_SIZE,
    borderRadius: BOOKMARK_SCRIM_SIZE / 2,
    backgroundColor: Theme.colors.overlay,
  },
  caption: {
    marginTop: 8,
    gap: 2,
  },
  title: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.meta,
    lineHeight: 20,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
    lineHeight: 18,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.medium,
    fontSize: Theme.type.caption,
    lineHeight: 18,
  },
  skeletonTitle: {
    width: "80%",
    height: 12,
    marginVertical: 4,
    borderRadius: 6,
    backgroundColor: Theme.colors.surface,
  },
  skeletonMeta: {
    width: "40%",
    height: 10,
    marginVertical: 4,
    borderRadius: 5,
    backgroundColor: Theme.colors.surface,
  },
});
