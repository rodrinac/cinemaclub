import React, { useEffect, useState } from 'react';
import { View, Text, Platform, KeyboardAvoidingView, StyleSheet, NativeSyntheticEvent, TextInputSubmitEditingEventData, Picker, Modal, Alert } from 'react-native';
import { TextInput, TouchableOpacity, TouchableHighlight, FlatList } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import api, { TmdbGenre, TmdbMovieList, TmdbGenreList } from '../../api/tmdb';
import VerticalMovieCard from '../../components/VerticalMovieCard';
import Theme from '../../theme';

const SearchMovie = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<number>(0);
  const [genres, setGenres] = useState<TmdbGenre[]>([]);
  const [foundMovies, setFoundMovies] = useState<TmdbMovieList>();

  useEffect(() => {
    async function requestMovieGenres() {
      const response = await api.get<TmdbGenreList>('genre/movie/list');

      setGenres(response.data.genres);      
    }
    
    requestMovieGenres();
  }, []);

  async function handleSubmitEditing(event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) {
    const searchQuery = event.nativeEvent.text;
    
    const response = await api.get<TmdbMovieList>('search/movie', {
      params: {
        query: searchQuery,
        page: 1
      }
    });
     
    setFoundMovies(response.data);
  }

  return (
    <KeyboardAvoidingView
      behavior={ Platform.OS === 'ios' ? 'padding' : undefined } 
      style={{flex: 1}}>
        
      <View style={styles.header}>
        <Text style={styles.title}>SEARCH</Text>
        <View style={styles.search}>
          <TextInput 
            style={styles.searchInput}            
            placeholder="🔍 Search a movie"
            onSubmitEditing={handleSubmitEditing}/>
          <TouchableOpacity style={styles.searchFilter} onPress={() => setModalVisible(true)}>          
            <MaterialCommunityIcons 
              name="filter-outline"
              color={Theme.colors.accentLighter}
              size={36} />
          </TouchableOpacity>
          <Modal
            animationType="slide"
            transparent={false}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}>
            <View style={{ marginTop: 22 }}>
              <View>
                <Picker
                  mode="dropdown"
                  selectedValue={selectedGenre}
                  style={{ height: 50, width: 100 }}
                  onValueChange={(itemValue, itemIndex) => setSelectedGenre(itemValue)}>
                  <Picker.Item label="All" value={0} />
                  {genres.map(genre => (
                    <Picker.Item
                      key={genre.id}
                      label={genre.name} 
                      value={genre.id}
                    />))}
                </Picker>

                <TouchableHighlight onPress={() => setModalVisible(false)}>
                  <Text>Hide Modal</Text>
                </TouchableHighlight>
              </View>
            </View>
          </Modal>
        </View>
      </View>
      <View style={styles.main}>
        { foundMovies &&
          <FlatList
            data={foundMovies.results}
            numColumns={2}
            renderItem={({item}) => <VerticalMovieCard movie={item} onPosterPress={() => {}} />}
            keyExtractor={item => item.id.toString()}
            onEndReached={() => {}}
            onEndReachedThreshold={0.2}
          />
        }
      </View>
    </KeyboardAvoidingView>
  );
}

export default SearchMovie;

const styles = StyleSheet.create({
  header: {
    paddingLeft: 22,
    backgroundColor: Theme.colors.primary
  },
  title: {
    color: Theme.colors.accent,
    fontSize: 32,
    fontFamily: 'Ubuntu_700Bold',
    maxWidth: 260,
    marginTop: 64,
  },
  search: {
    flexDirection: 'row',
    marginVertical: 16, 
  },
  searchInput: {
    flex: 1,
    backgroundColor: Theme.colors.primaryDarker,
    color: Theme.colors.accentLighter,
    fontSize: 18,
    borderRadius: 12,
    padding: 12
  },
  searchFilter: {
    marginHorizontal: 12,
    backgroundColor: Theme.colors.primaryDarker,
    borderRadius: 12,
    padding: 8
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: Theme.colors.background
  },
});