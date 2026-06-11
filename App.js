import React from 'react';
import RecordScreen from './src/screens/RecordScreen';
import RaveScreen from './src/screens/RaveScreen';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './src/store/store';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

// Import de la vue Home que nous allons créer à l'étape suivante
import HomeScreen from './src/screens/HomeScreen';

// Placeholders temporaires pour les vues Record et RAVE
// function RecordScreenPlaceholder() {
//   return <View style={styles.center}><Text>Écran Enregistrer (Bientôt disponible)</Text></View>;
// }

// function RaveScreenPlaceholder() {
//   return <View style={styles.center}><Text>Écran RAVE (Bientôt disponible)</Text></View>;
// }

const Tab = createMaterialTopTabNavigator();

export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <NavigationContainer>
          <SafeAreaView style={styles.container}>
            <Tab.Navigator
              initialRouteName="Home"
              screenOptions={{
                tabBarActiveTintColor: '#007AFF',
                tabBarInactiveTintColor: 'gray',
                tabBarLabelStyle: { fontSize: 12, fontWeight: 'bold' },
                tabBarIndicatorStyle: { backgroundColor: '#007AFF' },
              }}
            >
              <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Configuration' }} />
              <Tab.Screen name="Record" component={RecordScreen} options={{ tabBarLabel: 'Enregistrer' }} />
              <Tab.Screen name="Rave" component={RaveScreen} options={{ tabBarLabel: 'Rave' }} />
            </Tab.Navigator>
          </SafeAreaView>
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});