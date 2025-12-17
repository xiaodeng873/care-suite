import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <View style={styles.appWrapper}>
          <AppNavigator />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appWrapper: {
    flex: 1,
    // compress vertical space only to reduce top/bottom clipping
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#f9fafb',
    paddingTop: 50,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    transform: [{ scale: 1  

     }],
  },
});
