import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";

import * as database from "../../api/database";
import { TmdbMovie, getQueued } from "../../api/tmdb";
import Theme from "../../theme";

interface Props {
  movie: TmdbMovie;
  onPosterPress?: () => void;
}

const VerticalMovieCard: React.FC<Props> = ({ movie, onPosterPress }) => {
  const [bookmarked, setBookmarked] = useState<boolean>();
  const [actors, setActors] = useState("Loading...");
  const [directors, setDirectors] = useState("Loading...");
  const [runtime, setRuntime] = useState("Loading...");

  const voteAverage = Math.floor(movie.vote_average);
  const stars = [0, 2, 4, 6, 8].map((n) => voteAverage > n).map((v) => (v ? "⭐" : "☆"));

  useEffect(() => {
    async function fetchExtraDetails() {
      const movieDetails = await getQueued<TmdbMovie>(
        `movie/${movie.id}?append_to_response=credits`,
      );

      const foundActors = movieDetails.credits?.cast
        .slice(0, 2)
        .map((credit) => credit.name)
        .join(", ");

      setActors(foundActors || actors);

      const foundDirectors = movieDetails.credits?.crew
        .filter((credit) => credit.department === "Directing")
        .slice(0, 2)
        .map((credit) => credit.name)
        .join(", ");

      setDirectors(foundDirectors || directors);

      const hours = Math.floor(movieDetails.runtime / 60);
      const minutes = movieDetails.runtime % 60;

      setRuntime(`${hours}h${minutes.toString().padStart(2, "0")}min`);
    }

    fetchExtraDetails();
  }, [actors, directors, movie.id]);

  const toggleBookmarked = useCallback(async () => {
    if (bookmarked) {
      await database.removeBookmark(movie);
    } else {
      await database.addBookmark(movie);
    }

    setBookmarked(!bookmarked);
  }, [bookmarked, movie]);

  useEffect(() => {
    (async () => {
      setBookmarked(await database.hasBookmark(movie));
    })();
  }, [movie]);

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg";

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.posterWrapper} onPress={onPosterPress}>
        <Image
          style={styles.poster}
          source={{ uri: posterUrl }}
          resizeMode="cover"
          borderRadius={8}
        />
      </TouchableOpacity>
      <View style={styles.movieDetails}>
        <View style={styles.titleWrapper}>
          <Text style={styles.movieTitle} numberOfLines={1}>
            {movie.title}
          </Text>

          <Ionicons
            style={styles.bookmark}
            name="bookmark"
            color={bookmarked ? "#ffd700" : "#FFF"}
            size={18}
            onPress={toggleBookmarked}
          />
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
              <Text style={styles.stars}>{stars}</Text>
              <Text style={styles.duration}>{runtime}</Text>
            </View>
            <Text style={styles.voteAverage}>{movie.vote_average?.toFixed(1) ?? "0.0"}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default VerticalMovieCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    elevation: 2,
  },
  titleWrapper: {
    display: "flex",
    flexDirection: "row",
  },
  bookmark: {},
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
    color: Theme.colors.accentLighter,
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
