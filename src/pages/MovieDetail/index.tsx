import React, { useState, useEffect } from 'react';
import { StyleSheet, KeyboardAvoidingView, ImageBackground, Platform, Text, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AppLoading } from 'expo';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Feather, Entypo, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import api, { TmdbMovie } from '../../api/tmdb';

interface Params {
  movieId: number
}

const MovieDetail = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const routeParams = route.params as Params;

  const [movie, setMovie] = useState<TmdbMovie>();
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    setBookmarked(Math.floor(Math.random() * 2) === 1);
  }, []);

  useEffect(() => {
    async function requestMovieDetail() {
      const response = await api.get<TmdbMovie>(`movie/${routeParams.movieId}`);

      setMovie(response.data);
    }
    
    requestMovieDetail();
  }, []);


  if (!movie) {
    return <AppLoading />;
  }

  function getReleaseYear(): number {
    const releaseDate = new Date(movie!.release_date);

    return releaseDate.getFullYear();
  }
  
  return (
    <KeyboardAvoidingView
      behavior={ Platform.OS === 'ios' ? 'padding' : undefined } 
      style={{flex: 1}}>
      <Ionicons 
        style={styles.bookmark}
        name="ios-bookmark"
        color={bookmarked ? '#ffd700' : '#FFF'}
        onPress={() => setBookmarked(!bookmarked)}
        size={24}
      />
      <ImageBackground
        style={styles.container} 
        source={{uri: `https://image.tmdb.org/t/p/w342${movie.poster_path}`}}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', '#2e2a27']}
          start={[0.0, 0.1]}
          style={styles.linearGradient}
        />
        <View>     
          <Text style={styles.yearAndGenre}>{getReleaseYear()} • {movie.genres[0]?.name || '?'}</Text>
          <View style={styles.rating}>
            <Text style={styles.ratingOwned}>{movie.vote_average} </Text>
            <Text style={styles.ratingBase}>/ 10</Text>
            <Text style={styles.ratingProvider}> IMDb</Text>
          </View>
          <Text style={styles.title}>{movie.title.toUpperCase()}</Text>
          <Text style={styles.overview}>{movie.overview}</Text>
          <View style={styles.play}>
            <TouchableOpacity style={styles.playButton}>
              { movie.video
                ? <Entypo name='controller-play' color="#2e2a19" size={24}/>
                : <MaterialCommunityIcons name="web" color="#2e2a19" size={24}/>
              }
            </TouchableOpacity>
          </View>          
        </View>        
      </ImageBackground>
      <View style={styles.footer}>
          <TouchableOpacity style={styles.footerNavItem}>
            <Feather name="grid" color="#fff" size={24} />
          </TouchableOpacity>          
          <TouchableOpacity style={styles.footerNavItem} onPress={() => navigation.navigate('SearchMovie')}>
            <Feather name="search" color="#fff" size={24} />
        </TouchableOpacity>        
      </View>
    </KeyboardAvoidingView>
  );
}

export default MovieDetail;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 32,
    justifyContent: 'flex-end'
  },
  linearGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  bookmark: {
    position: 'absolute',
    top: 52,
    right: 42,
    zIndex: 1
  },
  yearAndGenre: {
    color: '#fff'
  },
  title: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: 'Ubuntu_700Bold',
    maxWidth: 260,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  ratingOwned: {
    color: '#fff',
    fontWeight: 'bold'
  },
  ratingBase: {
    color: '#f1f1f1',
    fontWeight: '100',
    fontSize: 12,
  },
  ratingProvider: {
    color: '#ffd700',
    fontWeight: 'bold'
  },
  overview: {
    color: '#fff'
  },
  play: {
    alignItems: 'center',
    paddingTop: 24
  },
  playButton: {
    backgroundColor: '#ffd700',
    borderRadius: 24,
    padding: 18
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2e2a27'
  },
  footerNavItem: {
    margin: 12,
  },
});