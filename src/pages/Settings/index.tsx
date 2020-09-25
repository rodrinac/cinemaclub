import React from 'react';
import { View, Text, Platform, KeyboardAvoidingView, StyleSheet } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { List, Switch } from 'react-native-paper';
import Theme from '../../theme';

const Settings = () => {
  const navigation = useNavigation();

  const [isSwitchOn, setIsSwitchOn] = React.useState(false);

  const onToggleSwitch = () => setIsSwitchOn(!isSwitchOn);

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
              name="ios-help-circle-outline"
              color="#FFF"            
              size={24}
              />
            </TouchableOpacity>
        </View>
        <Text style={styles.title}>SETTINGS</Text>
      </View>
      <View style={styles.main}>
        <TouchableOpacity onPress={onToggleSwitch} style={styles.listItem}>
          <List.Item
            title="Adult Content"
            description="Hide adult content"
            accessibilityValue="adult.content"
            style={{flex: 1}}
          />
          <Switch value={isSwitchOn} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem}>
          <List.Item
            title="Privacy"
            description="Terms of Service"
            accessibilityValue="terms.of.service"
            style={{flex: 1}}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.listItem} onPress={() => StoreReview.requestReview()}>
          <List.Item
            title="Review"
            description="Send your feedback"
            accessibilityValue="send.your.feedback"
            style={{flex: 1}}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default Settings;

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
  main: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 12
  },
  listItem: {
    
    flexDirection: 'row'
  }
});