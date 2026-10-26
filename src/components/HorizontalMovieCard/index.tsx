import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { TmdbMovie } from "../../api/tmdb";
import { getMovieDetails } from "../../api/tmdb/movieDetailsCache";
import Theme from "../../theme";
import { BrandArt } from "@/theme/brandArt";
import AnimatedPressable from "../AnimatedPressable";
import BookmarkButton from "../BookmarkButton";

type Props = {
  movie: TmdbMovie;
  onPosterPress?: () => void;
};

// Shown while credits load, and kept when they are unavailable.
const PLACEHOLDER_TEXT = "—";

const STAR_THRESHOLDS = [0, 2, 4, 6, 8];

const POSTER_WIDTH = 72;
const POSTER_HEIGHT = (POSTER_WIDTH / 2) * 3;
const BOOKMARK_SIZE = 20;
// BookmarkButton pads its icon up to a 44pt touch target; pull that padding back
// so the icon lines up with the rating below it.
const BOOKMARK_PADDING = (44 - BOOKMARK_SIZE) / 2;

const getReleaseYear = (releaseDate?: string) => {
  const year = releaseDate?.slice(0, 4);

  return year && /^\d{4}$/.test(year) ? year : undefined;
};

const formatRuntime = (totalMinutes?: number) => {
  if (!totalMinutes || totalMinutes < 0) {
    return undefined;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h${minutes.toString().padStart(2, "0")}min` : `${minutes}min`;
};

const HorizontalMovieCard: React.FC<Props> = ({ movie, onPosterPress }) => {
  const [actors, setActors] = useState(PLACEHOLDER_TEXT);
  const [directors, setDirectors] = useState(PLACEHOLDER_TEXT);
  const [runtime, setRuntime] = useState<string>();

  const voteAverage = Math.floor(movie.vote_average);
  const ratingText = movie.vote_average?.toFixed(1) ?? "0.0";
  const ratingLabel = `Rated ${ratingText} out of 10`;
  const meta = [getReleaseYear(movie.release_date), runtime].filter(Boolean).join(" · ");

  useEffect(() => {
    let isActive = true;

    async function fetchExtraDetails() {
      try {
        const movieDetails = await getMovieDetails(movie.id);

        if (!isActive) {
          return;
        }

        const foundActors = movieDetails.credits?.cast
          .slice(0, 2)
          .map((credit) => credit.name)
          .join(", ");

        setActors(foundActors || PLACEHOLDER_TEXT);

        const foundDirectors = movieDetails.credits?.crew
          .filter((credit) => credit.department === "Directing")
          .slice(0, 2)
          .map((credit) => credit.name)
          .join(", ");

        setDirectors(foundDirectors || PLACEHOLDER_TEXT);

        setRuntime(formatRuntime(movieDetails.runtime));
      } catch {
        if (isActive) {
          setActors(PLACEHOLDER_TEXT);
          setDirectors(PLACEHOLDER_TEXT);
          setRuntime(undefined);
        }
      }
    }

    fetchExtraDetails();

    return () => {
      isActive = false;
    };
  }, [movie.id]);

  const posterSource = movie.poster_path
    ? { uri: `https://image.tmdb.org/t/p/w342${movie.poster_path}` }
    : BrandArt.posterPlaceholder;

  return (
    <View style={styles.row}>
      <AnimatedPressable
        borderless
        style={styles.posterButton}
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
      {/*
        Tapping the text opens the movie too, but the poster stays the one button
        exposed to assistive tech (and the keyboard), so this one is skipped by both.
      */}
      <AnimatedPressable
        borderless
        style={styles.detailsButton}
        contentStyle={styles.details}
        onPress={onPosterPress}
        accessible={false}
        tabIndex={-1}
      >
        <Text style={styles.title} numberOfLines={2}>
          {movie.title}
        </Text>
        {meta.length > 0 && <Text style={styles.meta}>{meta}</Text>}
        <Text style={styles.credit} numberOfLines={1}>
          With {actors}
        </Text>
        <Text style={styles.credit} numberOfLines={1}>
          Directed by {directors}
        </Text>
      </AnimatedPressable>
      <View style={styles.side}>
        <BookmarkButton movie={movie} size={BOOKMARK_SIZE} style={styles.bookmark} />
        <View style={styles.rating}>
          <Text style={styles.score} aria-hidden>
            {ratingText}
          </Text>
          <View
            style={styles.stars}
            accessible
            accessibilityRole="image"
            accessibilityLabel={ratingLabel}
          >
            {STAR_THRESHOLDS.map((threshold) => (
              <Ionicons
                key={threshold}
                name={voteAverage > threshold ? "star" : "star-outline"}
                color={Theme.colors.gold}
                size={12}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default HorizontalMovieCard;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
  },
  posterButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
    backgroundColor: Theme.colors.surface,
  },
  detailsButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
  },
  details: {
    gap: 3,
  },
  title: {
    color: Theme.colors.text,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.body,
    lineHeight: 22,
  },
  meta: {
    color: Theme.colors.textMuted,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
    lineHeight: 18,
  },
  credit: {
    color: Theme.colors.accentLighter,
    fontFamily: Theme.fonts.body,
    fontSize: Theme.type.caption,
    lineHeight: 18,
  },
  side: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  bookmark: {
    marginTop: -BOOKMARK_PADDING,
    marginRight: -BOOKMARK_PADDING,
  },
  rating: {
    alignItems: "flex-end",
    gap: 2,
  },
  score: {
    color: Theme.colors.gold,
    fontFamily: Theme.fonts.semibold,
    fontSize: Theme.type.title,
    fontVariant: ["tabular-nums"],
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
});
