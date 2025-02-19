import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Dimensions, Image, StyleSheet, View } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import * as database from "../../api/database";
import { TmdbMovie } from "../../api/tmdb";
import Theme from "../../theme";

const screenWidth = Dimensions.get("window").width;
const posterWidth = screenWidth / 2 - 16;
const posterHeight = (posterWidth / 140) * 210;

type Props = {
  movie: TmdbMovie;
  onPosterPress?: () => void;
};

const VerticalMovieCard: React.FC<Props> = ({ movie, onPosterPress }) => {
  const [bookmarked, setBookmarked] = useState<boolean>();

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
      <TouchableOpacity onPress={onPosterPress}>
        <Image
          style={styles.poster}
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
  },
  bookmark: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 1,
  },
  poster: {
    width: posterWidth,
    height: posterHeight,
  },
});
