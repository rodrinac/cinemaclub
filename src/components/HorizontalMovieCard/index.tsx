import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { TmdbMovie } from "../../api/tmdb";
import { getMovieDetails } from "../../api/tmdb/movieDetailsCache";
import AnimatedPressable from "../AnimatedPressable";
import BookmarkButton from "../BookmarkButton";
import Theme from "../../theme";

type Props = {
  movie: TmdbMovie;
  onPosterPress?: () => void;
};

// Shown while credits load, and kept when they are unavailable.
const PLACEHOLDER_TEXT = "—";

const STAR_THRESHOLDS = [0, 2, 4, 6, 8];

const HorizontalMovieCard: React.FC<Props> = ({ movie, onPosterPress }) => {
  const [actors, setActors] = useState(PLACEHOLDER_TEXT);
  const [directors, setDirectors] = useState(PLACEHOLDER_TEXT);
  const [runtime, setRuntime] = useState<string>();

  const voteAverage = Math.floor(movie.vote_average);
  const ratingLabel = `Rated ${movie.vote_average?.toFixed(1) ?? "0.0"} out of 10`;

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

        const hours = Math.floor(movieDetails.runtime / 60);
        const minutes = movieDetails.runtime % 60;

        setRuntime(`${hours}h${minutes.toString().padStart(2, "0")}min`);
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

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg";

  return (
    <View style={styles.container}>
      <AnimatedPressable
        contentStyle={styles.posterWrapper}
        onPress={onPosterPress}
        accessibilityRole="button"
        accessibilityLabel={movie.title}
      >
        <Image
          accessible={false}
          style={styles.poster}
          source={{ uri: posterUrl }}
          resizeMode="cover"
          borderRadius={8}
        />
      </AnimatedPressable>
      <View style={styles.movieDetails}>
        <View style={styles.titleWrapper}>
          <Text style={styles.movieTitle} numberOfLines={1}>
            {movie.title}
          </Text>

          <BookmarkButton movie={movie} size={18} style={styles.bookmark} />
        </View>
        <View>
          <Text style={styles.actor} numberOfLines={1}>
            Actors: {actors}
          </Text>
          <Text style={styles.director} numberOfLines={1}>
            Directors: {directors}
          </Text>
          <View style={styles.votesGroup}>
            <View style={styles.starsAndDuration}>
              <View style={styles.stars} accessible accessibilityLabel={ratingLabel}>
                {STAR_THRESHOLDS.map((threshold) => (
                  <Ionicons
                    key={threshold}
                    name={voteAverage > threshold ? "star" : "star-outline"}
                    color={Theme.colors.gold}
                    size={14}
                  />
                ))}
              </View>
              {runtime && <Text style={styles.duration}>{runtime}</Text>}
            </View>
            <Text style={styles.voteAverage} accessibilityElementsHidden importantForAccessibility="no">{movie.vote_average?.toFixed(1) ?? "0.0"}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default HorizontalMovieCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: Theme.colors.surface,
    flexDirection: "row",
    elevation: 2,
  },
  titleWrapper: {
    display: "flex",
    flexDirection: "row",
  },
  bookmark: {
    margin: -13,
  },
  posterWrapper: {},
  poster: {
    width: 91,
    height: 136.5,
  },
  movieDetails: {
    paddingHorizontal: 18,
    justifyContent: "space-evenly",
    flex: 1,
  },
  movieTitle: {
    color: Theme.colors.accent,
    fontFamily: "RobotoCondensed_400Regular",
    fontSize: 18,
    flexGrow: 1,
  },
  actor: {
    color: Theme.colors.accentLighter,
  },
  director: {
    color: Theme.colors.accentLighter,
  },
  votesGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  starsAndDuration: {
    flex: 1,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  voteAverage: {
    fontSize: 36,
    fontFamily: "RobotoCondensed_400Regular",
    color: Theme.colors.gold,
    alignSelf: "flex-end",
  },
  duration: {
    color: Theme.colors.accentLighter,
  },
});
