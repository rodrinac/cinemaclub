import React, { useState, useEffect } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TmdbMovie } from '../../api/tmdb';
import { TouchableOpacity } from 'react-native-gesture-handler';
import database from '../../api/database';

interface Props {
  movie: TmdbMovie;
  onPosterPress?: () => void;
}

const VerticalMovieCard: React.FC<Props> = ({movie, onPosterPress}) => {
  
  const [bookmarked, setBookmarked] = useState<boolean>();

  useEffect(() => { 
    fetchBookmarkStatus();
  }, [])
  
  async function fetchBookmarkStatus() {
    setBookmarked(await database.existsBookmark(movie));
  }

  async function changeBookmarkStatus() {
    if (bookmarked) {
      await database.removeBookmark(movie);
    } else {
      await database.addBookmark(movie);
    }

    await fetchBookmarkStatus();
  }

  return (
    <View style={styles.container}>
      <Ionicons 
        style={styles.bookmark}
        name="ios-bookmark"
        color={bookmarked ? '#ffd700' : '#FFF'}
        size={18}
        onPress={changeBookmarkStatus}
      />
      <TouchableOpacity onPress={onPosterPress}>
        <Image 
          style={styles.poster}
          source={{uri: `https://image.tmdb.org/t/p/w342${movie.poster_path}`}}
          resizeMode="cover"
          borderRadius={12} />
      </TouchableOpacity>
    </View>
  );
}

export default VerticalMovieCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    backgroundColor: 'transparent'
  },
  bookmark: {
    position: 'absolute',
    top: 18,
    right: 52,
    zIndex: 1
  },
  poster: {
    width: 140,
    height: 210,
  }
});