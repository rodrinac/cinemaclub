import React, { useEffect, useState } from 'react';
import { Text, KeyboardAvoidingView, Platform, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';

import tmdb, { TmdbMovieList, TmdbMovie } from '../../api/tmdb';
import VerticalMovieCard from '../../components/VerticalMovieCard';
import Theme from '../../theme';

const Home = () => {
  const navigation = useNavigation();
  
  const [movieList, setMovieList] = useState<TmdbMovieList>();
  const [pageToLoad, setPageToLoad] = useState(1);

  useEffect(() => {
    async function requestDiscoverMovies() {
      const response = await tmdb.get<TmdbMovieList>('discover/movie', {
        params: {
          page: pageToLoad,
          sortBy: "popularity.desc"
        }
      });

      const responseData = response.data;
      const currentMovieList = movieList?.results || [];

      setMovieList({...responseData, results: currentMovieList.concat(responseData.results)});     
    }

    try {
      requestDiscoverMovies();
    } catch(e) {
      console.log(e);
    }
  }, [pageToLoad]);

  function handleMoviePosterPress(movie: TmdbMovie) {
    navigation.navigate('MovieDetail', { movieId: movie.id })
  }

  return (
    <KeyboardAvoidingView behavior={ Platform.OS === 'ios' ? 'padding' : undefined } style={{flex: 1}}>
      <View style={styles.header}>
        <Text style={styles.title}>DISCOVER</Text>
        <View style={styles.menu}>
          <Text style={styles.menuItem}>Now</Text>
          <Text style={[styles.menuItem, styles.menuItemActive]}>Popular</Text>
          <Text style={styles.menuItem}>Upcomming</Text>
          <Text style={styles.menuItem}>{' '}</Text>
        </View>
      </View>
      <View style={styles.main}>
        { movieList &&
          <FlatList 
            data={movieList.results}
            numColumns={2}
            renderItem={({item}) => <VerticalMovieCard movie={item} onPosterPress={() => handleMoviePosterPress(item)} />}
            keyExtractor={item => item.id.toString()}
            onEndReached={() => setPageToLoad(pageToLoad + 1)}
            onEndReachedThreshold={0.2}
          />
        }
      </View>
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

export default Home;

const styles = StyleSheet.create({
  header: {
    paddingLeft: 22,
    backgroundColor: Theme.colors.primary
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: Theme.colors.background
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Theme.colors.primary
  },
  footerNavItem: {
    margin: 12,
  },
  title: {
    color: Theme.colors.accent,
    fontSize: 32,
    fontFamily: 'Ubuntu_700Bold',
    maxWidth: 260,
    marginTop: 64,
  },
  menu: {
    fontSize: 16,
    marginVertical: 16,   
    flexDirection: 'row',
  },
  menuItem: {
    color: Theme.colors.accentLighter,
    marginEnd: 12,
    fontFamily: 'Roboto_400Regular',
    fontWeight: 'bold'
  },
  menuItemActive: {
    color: Theme.colors.accent,
  }
});