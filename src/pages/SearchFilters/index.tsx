import React, { useEffect, useState } from 'react';
import { View, Text, Platform, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { TouchableOpacity, FlatList } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import api, { TmdbGenreList } from '../../api/tmdb';
import Theme from '../../theme';
import GenreCard from '../../components/GenreCard';

enum Filter {
  WITH_THESE,
  WITHOUT_THESE
}

const SearchFilters = () => {
  const navigation = useNavigation();
  
  const withoutTheseColor = '#ED0000';
  const withTheseColor = '#B7990D';

  const [genreList, setGenreList] = useState<TmdbGenreList>();
  const [filter, setFilter] = useState(Filter.WITH_THESE);
  const [color, setColor] = useState(withTheseColor);

  useEffect(() => {
    async function fetchGenres() {
      const response = await api.get<TmdbGenreList>('genre/movie/list');
      
      setGenreList(response.data);
    }

    fetchGenres();
  }, []);

  useEffect(() => {
    if (filter === Filter.WITH_THESE) {
      setColor(withTheseColor);
    } else {
      setColor(withoutTheseColor);
    }
  }, [filter]);

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
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem}>
            <Text 
              style={[styles.menuItemText, filter === Filter.WITH_THESE ? styles.menuItemTextActive : {}]}
              onPress={() => setFilter(Filter.WITH_THESE)}>
                Now
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text
              style={[styles.menuItemText, filter === Filter.WITHOUT_THESE ? styles.menuItemTextActive : {}]}
              onPress={() => setFilter(Filter.WITHOUT_THESE)}>
                Popular
            </Text>
          </TouchableOpacity>
          <Text style={styles.menuItem}>{' '}</Text>
          </View>
      </View>
      <View style={styles.main}>
        { genreList &&
          <FlatList
            data={genreList.genres}
            renderItem={({item}) => <GenreCard color={color} genre={item}/>}
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
  menu: {
    fontSize: 16,
    marginVertical: 16,   
    flexDirection: 'row',
  },
  menuItem: {    
    marginEnd: 12
  },
  menuItemText: {
    color: Theme.colors.accentLighter,
    fontFamily: 'Roboto_400Regular',
    fontWeight: 'bold'
  },
  menuItemTextActive: {
    color: Theme.colors.accent,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 12
  },
});