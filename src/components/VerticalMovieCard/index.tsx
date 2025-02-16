import React, { useState, useEffect } from "react";
import { Dimensions, Image, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native-gesture-handler";
import { TmdbMovie } from "../../api/tmdb";
import * as database from "../../api/database";

const screenWidth = Dimensions.get("window").width;
const posterWidth = screenWidth / 2 - 16; // Adjust for padding
const posterHeight = (posterWidth / 140) * 210; // Maintain aspect ratio (140x210)

interface Props {
  movie: TmdbMovie;
  onPosterPress?: () => void;
}

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
        style={styles.bookmark}
        name={bookmarked ? "bookmark" : "bookmark-outline"}
        color={bookmarked ? "#ffd700" : "#FFF"}
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
    top: 18,
    right: 16,
    zIndex: 1,
  },
  poster: {
    width: posterWidth,
    height: posterHeight,
  },
});
