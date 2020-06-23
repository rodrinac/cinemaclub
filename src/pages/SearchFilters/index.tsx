import React, { useEffect, useState } from 'react';
import { View, Text, Platform, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { TouchableOpacity, FlatList } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import api, { TmdbGenreList } from '../../api/tmdb';
import Theme from '../../theme';
import GenreCard from '../../components/GenreCard';

interface PageToLoad {
  number: number,
  searchQuery: string
}

const SearchFilters = () => {
  const navigation = useNavigation();

  const [genreList, setGenreList] = useState<TmdbGenreList>();

  const colors = [ '#A5D0A8', '#8CADA7', '#B7990D', '#F2F4CB'];

  useEffect(() => {

    async function fetchGenres() {
      const response = await api.get<TmdbGenreList>('genre/movie/list');
      
      setGenreList(response.data);
    }

    fetchGenres();
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={ Platform.OS === 'ios' ? 'padding' : undefined } 
      style={{flex: 1}}>
        
      <View style={styles.header}>
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="ios-arrow-round-back" size={24} color="#FFF"/>
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons 
              name="ios-options"
              color="#FFF"            
              size={24}
              />
            </TouchableOpacity>
        </View>
        <Text style={styles.title}>FILTERS</Text>
        <View style={styles.search}>
          <TouchableOpacity style={styles.searchFilter} onPress={() => {}}>          
            <Text style={styles.searchFilterText}>With These</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchFilter} onPress={() => {}}>          
            <Text style={styles.searchFilterText}>Without These</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.main}>
        { genreList &&
          <FlatList
            data={genreList.genres}
            renderItem={({item, index}) => <GenreCard color={colors[index % 4]} genre={item}/>}
            keyExtractor={item => item.id.toString()}
            numColumns={2}
          />
        }
      </View>
    </KeyboardAvoidingView>
  );
}

export default SearchFilters;

const styles = StyleSheet.create({
  header: {
    paddingLeft: 22,
    backgroundColor: Theme.colors.primary,
    elevation: 4
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32
  },
  title: {
    color: Theme.colors.accent,
    fontSize: 32,
    fontFamily: 'RobotoCondensed_700Bold',
    maxWidth: 260,
    marginTop: 64,
  },
  search: {
    flexDirection: 'row',
    marginVertical: 16, 
  },
  searchFilter: {
    marginHorizontal: 12,
    backgroundColor: Theme.colors.primaryDarker,
    borderRadius: 8,
    padding: 8
  },
  searchFilterText: {
    color: Theme.colors.accentLighter
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 12
  },
});