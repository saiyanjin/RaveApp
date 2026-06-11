import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setServerConfig, setConnectionStatus } from '../store/appSlice';

export default function HomeScreen() {
  const dispatch = useDispatch();
  
  // Lecture des valeurs globales (remplies automatiquement au lancement si sauvegardées)
  // Ouvre HomeScreen.js et remplace par :
  const persistedIp = useSelector((state) => state.app?.ip || '');
  const persistedPort = useSelector((state) => state.app?.port || '');
  const isConnected = useSelector((state) => state.app?.isConnected || false);

  // États locaux du formulaire
  const [ip, setIp] = useState(persistedIp);
  const [port, setPort] = useState(persistedPort);
  const [loading, setLoading] = useState(false);

  const handleTestConnection = async () => {
    if (!ip || !port) {
      Alert.alert('Erreur', 'Veuillez renseigner l\'adresse IP et le port du serveur.');
      return;
    }

    setLoading(true);
    // Sauvegarde immédiate dans le Store Redux
    dispatch(setServerConfig({ ip, port }));

    try {
      // Appel de la route racine du serveur Flask ("/") spécifiée dans l'API
      const response = await fetch(`http://${ip}:${port}/`, { method: 'GET' });
      const text = await response.text();
      console.log("Réponse reçue du serveur Python :", text);

      if (text.includes("Connection success !")) {
        dispatch(setConnectionStatus(true));
        Alert.alert('Succès', 'Connexion réussie au serveur RAVE !');
      } else {
        dispatch(setConnectionStatus(false));
        Alert.alert('Échec', 'Le serveur a répondu mais le message est incorrect.');
      }
    } catch (error) {
      dispatch(setConnectionStatus(false));
      Alert.alert(
        'Erreur de connexion', 
        'Impossible de joindre le serveur. Assure-toi que ton ordinateur et ton téléphone partagent le même réseau Wi-Fi.'
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configuration du Serveur RAVE</Text>
      
      <Text style={styles.label}>Adresse IP :</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 192.168.1.XX"
        value={ip}
        onChangeText={setIp}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Port :</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 5000"
        value={port}
        onChangeText={setPort}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.button} onPress={handleTestConnection} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Tester la connexion</Text>}
      </TouchableOpacity>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Statut :{' '}
          <Text style={isConnected ? styles.connected : styles.disconnected}>
            {isConnected ? 'Connecté' : 'Déconnecté'}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f9f9f9' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#333' },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 5, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20, backgroundColor: '#fff', fontSize: 16 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusContainer: { marginTop: 30, alignItems: 'center' },
  statusText: { fontSize: 16, fontWeight: '500' },
  connected: { color: 'green', fontWeight: 'bold' },
  disconnected: { color: 'red', fontWeight: 'bold' },
});