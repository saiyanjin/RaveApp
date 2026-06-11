import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useDispatch, useSelector } from 'react-redux';
import { addRecord, deleteRecord } from '../store/recordSlice';

export default function RecordScreen() {
  const dispatch = useDispatch();
  // Récupération de la liste des enregistrements persistés dans Redux
  const records = useSelector((state) => state.records.records);

  // États pour l'enregistrement
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [tempUri, setTempUri] = useState(null);
  const [fileName, setFileName] = useState('');

  // États pour la lecture audio
  const [sound, setSound] = useState(null);
  const [playingId, setPlayingId] = useState(null); // ID du morceau en cours de lecture

  // Nettoyage du composant pour éviter les fuites de mémoire audio
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // 1. Commencer l'enregistrement
  const startRecording = async () => {
    try {
      // Demande d'autorisation d'accès au micro
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès au micro est requis pour enregistrer.');
        return;
      }

      // Configuration du mode audio pour iOS et Android
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Lancement de l'enregistrement en haute qualité
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      setTempUri(null); // Réinitialise l'ancien enregistrement non sauvegardé
    } catch (err) {
      console.error('Erreur lors du démarrage de l\'enregistrement', err);
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement.');
    }
  };

  // 2. Arrêter l'enregistrement
  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setTempUri(uri); // Stocke l'emplacement temporaire du cache
      setRecording(null);
    } catch (err) {
      console.error('Erreur lors de l\'arrêt de l\'enregistrement', err);
    }
  };

  // 3. Sauvegarder de façon persistante (Déplacement du cache vers DocumentDirectory)
  // 3. Sauvegarder de façon persiste (Déplacement du cache vers le stockage permanent)
  const saveRecording = async () => {
    if (!tempUri) return;
    if (!fileName.trim()) {
      Alert.alert('Erreur', 'Veuillez donner un nom à votre enregistrement.');
      return;
    }

    try {
      // Sécurité Web : Si documentDirectory n'existe pas sur navigateur, on crée un chemin relatif
      const baseDir = FileSystem.documentDirectory || './';
      const recordsDirectory = `${baseDir}records/`;
      
      // Sur le Web pur, certaines fonctions natives filesystem simulent ou échouent, 
      // mais utiliser l'import /legacy évite au moins le crash de l'application.
      if (FileSystem.documentDirectory) {
        const dirInfo = await FileSystem.getInfoAsync(recordsDirectory);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(recordsDirectory, { intermediates: true });
        }
      }

      // Création d'un nom de fichier unique
      const id = Date.now().toString();
      const finalUri = `${recordsDirectory}${id}_${fileName.trim().replace(/\s+/g, '_')}.m4a`;

      // Déplacement du fichier (uniquement si on a un vrai système de fichiers mobile)
      if (FileSystem.documentDirectory) {
        await FileSystem.moveAsync({
          from: tempUri,
          to: finalUri,
        });
      }

      // Enregistrement des métadonnées dans le Store Redux
      dispatch(addRecord({
        id,
        name: fileName.trim(),
        uri: FileSystem.documentDirectory ? finalUri : tempUri, // Secours Web
        timestamp: new Date().toLocaleString('fr-FR'),
      }));

      setTempUri(null);
      setFileName('');
      Alert.alert('Succès', 'Enregistrement sauvegardé avec succès !');
    } catch (err) {
      console.error('Erreur lors de la sauvegarde du fichier', err);
      Alert.alert('Erreur', 'Impossible de sauvegarder le fichier.');
    }
  };

  // 4. Écouter / Pause d'un enregistrement de la liste
  const handlePlayPause = async (item) => {
    // Si un son tourne déjà sur la même ligne, on le coupe
    if (sound && playingId === item.id) {
      await sound.stopAsync();
      setPlayingId(null);
      return;
    }

    // Si un autre son tourne, on le décharge proprement d'abord
    if (sound) {
      await sound.unloadAsync();
    }

    try {
      // Configuration du mode audio pour la lecture seule
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: item.uri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setPlayingId(item.id);

      // Détection automatique de la fin du morceau pour libérer le bouton Play
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingId(null);
        }
      });
    } catch (err) {
      console.error('Erreur lors de la lecture', err);
      Alert.alert('Erreur', 'Impossible de lire ce fichier audio.');
    }
  };

  // 5. Supprimer définitivement un enregistrement (Fichier physique + Redux)
  const handleDelete = async (item) => {
    Alert.alert(
      'Suppression',
      `Voulez-vous vraiment supprimer "${item.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              // Si le fichier supprimé est en cours de lecture, on le stoppe
              if (playingId === item.id && sound) {
                await sound.stopAsync();
                setPlayingId(null);
              }
              
              // 1. Suppression du fichier physique sur le disque dur du téléphone
              await FileSystem.deleteAsync(item.uri, { idempotent: true });
              
              // 2. Suppression de la référence dans l'état global Redux
              dispatch(deleteRecord(item.id));
            } catch (err) {
              console.error('Erreur lors de la suppression physique', err);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enregistreur Vocal</Text>

      {/* Section interactive de prise de son */}
      <View style={styles.recordBox}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordingActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>
            {isRecording ? '⏹ Arrêter l\'enregistrement' : '🎙 Commencer l\'enregistrement'}
          </Text>
        </TouchableOpacity>

        {isRecording && (
          <View style={styles.liveIndicator}>
            <ActivityIndicator color="red" size="small" />
            <Text style={styles.liveText}>Enregistrement en cours...</Text>
          </View>
        )}
      </View>

      {/* Section de nommage et sauvegarde (Visible uniquement si une piste est dans le cache) */}
      {tempUri && !isRecording && (
        <View style={styles.saveBox}>
          <Text style={styles.label}>Nommer votre piste audio :</Text>
          <TextInput
            style={styles.input}
            placeholder="Mon enregistrement..."
            value={fileName}
            onChangeText={setFileName}
          />
          <TouchableOpacity style={styles.saveButton} onPress={saveRecording}>
            <Text style={styles.buttonText}>💾 Sauvegarder de façon permanente</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.subtitle}>Vos enregistrements sauvegardés :</Text>

      {/* Liste de rendu de type FlatList exigée par le sujet */}
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucun enregistrement trouvé.</Text>}
        renderItem={({ item }) => (
          <View style={styles.recordItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.timestamp}</Text>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity style={styles.actionPlay} onPress={() => handlePlayPause(item)}>
                <Text style={styles.actionText}>{playingId === item.id ? '⏸' : '▶️'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionDelete} onPress={() => handleDelete(item)}>
                <Text style={styles.actionText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 22, fontWeight: 'bold', marginTop: 10, marginBottom: 20, textAlign: 'center', color: '#333' },
  subtitle: { fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, color: '#555' },
  recordBox: { alignItems: 'center', marginBottom: 20 },
  recordButton: { backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  recordingActive: { backgroundColor: '#333', transform: [{ scale: 1.03 }] },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  liveText: { color: 'red', fontWeight: 'bold', marginLeft: 8 },
  saveBox: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#eee', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 15, fontSize: 16, backgroundColor: '#fff' },
  saveButton: { backgroundColor: '#34C759', padding: 12, borderRadius: 8 },
  listContainer: { paddingBottom: 20 },
  // MODIFIEZ CETTE LIGNE :
recordItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#eee' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  itemMeta: { fontSize: 12, color: '#999', marginTop: 4 },
  itemActions: { flexDirection: 'row', gap: 10 },
  actionPlay: { backgroundColor: '#007AFF', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  actionDelete: { backgroundColor: '#FF3B30', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#aaa', marginTop: 20, fontSize: 14 },
});