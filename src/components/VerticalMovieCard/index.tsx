import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View, useWindowDimensions } from "react-native";
import * as database from "../../api/database";
import { TmdbMovie } from "../../api/tmdb";
import Theme from "../../theme";

type Props = {
  movie: TmdbMovie;
  onPosterPress?: () => void;
  columns?: number;
};

const VerticalMovieCard: React.FC<Props> = ({ movie, onPosterPress, columns = 2 }) => {
  const [bookmarked, setBookmarked] = useState<boolean>();
  const { width } = useWindowDimensions();

  const posterWidth = Math.max(110, (width - 48 - (columns - 1) * 12) / columns);
  const posterHeight = (posterWidth / 140) * 210;

  useEffect(() => {
    (async () => {
      setBookmarked(await database.hasBookmark(movie));
    })();
  }, [movie]);

  async function changeBookmarkStatus() {
    if (bookmarked) {
      await database.removeBookmark(movie);
    } else {
      await database.addBookmark(movie);
    }

    setBookmarked(!bookmarked);
  }

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg";

  return (
    <View style={styles.container}>
      <Ionicons
        style={[styles.bookmark, { opacity: bookmarked ? 0.5 : 1 }]}
        name={bookmarked ? "bookmark" : "bookmark-outline"}
        color={Theme.colors.accent}
        size={18}
        onPress={changeBookmarkStatus}
      />
      <TouchableOpacity onPress={onPosterPress} testID={`movie-poster-${movie.id}`}>
        <Image
          style={[styles.poster, { width: posterWidth, height: posterHeight }]}
          source={{ uri: posterUrl }}
          resizeMode="cover"
          borderRadius={12}
        />
      </TouchableOpacity>
    </View>
  );
};

export default VerticalMovieCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 8,
    backgroundColor: "transparent",
    elevation: 4,
    minWidth: 0,
  },
  bookmark: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 1,
  },
  poster: {
    backgroundColor: Theme.colors.surface,
  },
});
