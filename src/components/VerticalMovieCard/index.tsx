import React, { useState, useEffect } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TmdbMovie } from '../../api/tmdb';

interface Props {
  movie: TmdbMovie
}

const VerticalMovieCard: React.FC<Props> = ({movie}) => {
  
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setBookmarked(Math.floor(Math.random() * 2) === 1);
  }, []);

  return (
    <View style={styles.container}>
      <Feather 
        style={styles.bookmark}
        name="bookmark"
        color={bookmarked ? '#ffd700' : '#FFF'}
        onPress={() => setBookmarked(!bookmarked)}
      />
      <Image 
        style={styles.poster}
        source={{uri: `https://image.tmdb.org/t/p/w342${movie.poster_path}`}}
        resizeMode="cover"
        borderRadius={12} />
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
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)'
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