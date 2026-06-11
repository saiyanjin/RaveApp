import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useSelector } from 'react-redux';

export default function RaveScreen() {
  // 1. Récupération des données globales du Store Redux
  const records = useSelector((state) => state.records.records);
  // REMPLACEZ PAR :
  const serverIp = useSelector((state) => state.app?.ip || '127.0.0.1');
  const serverPort = useSelector((state) => state.app?.port || '8000');
  const serverAddress = `http://${serverIp}:${serverPort}`;

  // 2. États pour les modèles RAVE
  const [models, setModels] = useState(['Jazz', 'Darbouka', 'Parole', 'Chats', 'Chiens']); // Modèles par défaut exigés par le sujet
  const [selectedModel, setSelectedModel] = useState('Jazz');

  // 3. États pour la gestion des sous-onglets de sélection audio
  const [activeTab, setActiveTab] = useState('assets'); // 'assets' | 'records' | 'local'
  const [selectedAudio, setSelectedAudio] = useState(null); // { name: string, uri: string }
  const [transformedAudioUri, setTransformedAudioUri] = useState(null);

  // 4. États pour le statut du serveur et de la lecture
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [soundOriginal, setSoundOriginal] = useState(null);
  const [soundTransformed, setSoundTransformed] = useState(null);
  const [isPlayingOrig, setIsPlayingOrig] = useState(false);
  const [isPlayingTrans, setIsPlayingTrans] = useState(false);

  // Nettoyage des instances audio à la fermeture de l'écran
  useEffect(() => {
    return () => {
      if (soundOriginal) soundOriginal.unloadAsync();
      if (soundTransformed) soundTransformed.unloadAsync();
    };
  }, [soundOriginal, soundTransformed]);

  // Récupérer dynamiquement la liste des modèles depuis le serveur au chargement
  useEffect(() => {
    fetchModels();
  }, [serverAddress]);

  const fetchModels = async () => {
    try {
      const response = await fetch(`${serverAddress}/getmodels`);
      if (response.ok) {
        const data = await response.json();
        // CORRECTIF : Le serveur renvoie un objet avec une clé "models"
        if (data && Array.isArray(data.models)) {
          setModels(data.models); 
        }
      }
    } catch (err) {
      console.log("Serveur injoignable, utilisation des modèles RAVE par défaut.");
    }
  };

  // Sélectionner un modèle sur le serveur
  const handleSelectModel = async (modelName) => {
    setSelectedModel(modelName);
    try {
      await fetch(`${serverAddress}/selectModel/${modelName}`);
      Alert.alert('Modèle mis à jour', `Le modèle "${modelName}" a été sélectionné sur le serveur.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Fonction pour charger un fichier local du téléphone/PC
  const pickLocalDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedAudio({
          name: file.name,
          uri: file.uri,
        });
        setTransformedAudioUri(null); // Réinitialise l'ancienne transformation
      }
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de charger le fichier audio sélectionné.');
    }
  };

  // Envoi au serveur Python et Téléchargement automatique (Logique de l'annexe adaptée Web/Mobile)
  const handleTransformAudio = async () => {
    if (!selectedAudio) {
      Alert.alert('Erreur', 'Veuillez d\'abord sélectionner une piste audio.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Envoi du fichier et calcul RAVE en cours...');

    try {
      // ÉTAPE A : Upload du fichier original (S'adapte si environnement Web pur ou Mobile)
      if (!FileSystem.documentDirectory) {
        // Mode WEB conventionnel (Utilise FormData natif)
        const formData = new FormData();
        const responseFile = await fetch(selectedAudio.uri);
        const blob = await responseFile.blob();
        formData.append('file', blob, selectedAudio.name);

        const uploadResp = await fetch(`${serverAddress}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadResp.ok) throw new Error("Échec du téléversement sur le serveur.");
      } else {
        // Mode MOBILE natif (Reprend fidèlement la syntaxe de l'annexe du sujet)
        const response = await FileSystem.uploadAsync(`${serverAddress}/upload`, selectedAudio.uri, {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { filename: selectedAudio.name },
        });
        if (response.status !== 200) throw new Error("Erreur serveur lors du téléversement.");
      }

      // ÉTAPE B : Téléchargement automatique du résultat transformé
      setLoadingMessage('Calcul terminé ! Téléchargement de la version transformée...');
      const finalDownloadUrl = `${serverAddress}/download`;

      if (!FileSystem.documentDirectory) {
        // Mode WEB : On stocke l'URL directe du serveur pour la lecture audio
        setTransformedAudioUri(finalDownloadUrl);
      } else {
        // Mode MOBILE : Copie physique dans le DocumentDirectory persistant de l'app
        const targetDirectory = `${FileSystem.documentDirectory}transformed/`;
        const dirInfo = await FileSystem.getInfoAsync(targetDirectory);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(targetDirectory, { intermediates: true });
        }

        const localTargetUri = `${targetDirectory}rave_${Date.now()}.wav`;
        const downloadResult = await FileSystem.downloadAsync(finalDownloadUrl, localTargetUri);
        setTransformedAudioUri(downloadResult.uri);
      }

      Alert.alert('Succès', 'Votre audio a été transformé avec succès par le réseau de neurones !');
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur réseau', 'Impossible de communiquer correctement avec le serveur RAVE Python.');
    } finally {
      setIsLoading(false);
    }
  };

  // Gestion de l'écoute des pistes (Originale ou Transformée)
  const handlePlayPause = async (uri, isTransformed) => {
    const currentSound = isTransformed ? soundTransformed : soundOriginal;
    const setIsPlaying = isTransformed ? setIsPlayingTrans : setIsPlayingOrig;
    const setSound = isTransformed ? setSoundTransformed : setSoundOriginal;

    if (currentSound) {
      const status = await currentSound.getStatusAsync();
      if (status.isPlaying) {
        await currentSound.pauseAsync();
        setIsPlaying(false);
      } else {
        await currentSound.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          newSound.setPositionAsync(0);
        }
      });
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de lire cette piste audio.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Transfert de Timbre RAVE</Text>

      {/* 1. SECTION SELECTION DU MODELE NEURONAL */}
      <Text style={styles.sectionTitle}>1. Choisissez un modèle neuronal :</Text>
      <View style={styles.modelsContainer}>
        {models.map((model) => (
          <TouchableOpacity
            key={model}
            style={[styles.modelCard, selectedModel === model && styles.modelCardSelected]}
            onPress={() => handleSelectModel(model)}
          >
            <Text style={[styles.modelText, selectedModel === model && styles.modelTextSelected]}>
              🧠 {model}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 2. SECTION SYSTEME D'ONGLETS POUR SOURCING AUDIO */}
      <Text style={styles.sectionTitle}>2. Sélectionnez la source audio :</Text>
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'assets' && styles.tabButtonActive]} onPress={() => setActiveTab('assets')}>
          <Text style={[styles.tabButtonText, activeTab === 'assets' && styles.tabButtonTextActive]}>📦 Assets</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'records' && styles.tabButtonActive]} onPress={() => setActiveTab('records')}>
          <Text style={[styles.tabButtonText, activeTab === 'records' && styles.tabButtonTextActive]}>🎙️ Records</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'local' && styles.tabButtonActive]} onPress={() => setActiveTab('local')}>
          <Text style={[styles.tabButtonText, activeTab === 'local' && styles.tabButtonTextActive]}>📂 Local</Text>
        </TouchableOpacity>
      </View>

      {/* RENDU CONTENU DE L'ONGLET ACTIF */}
      <View style={styles.tabContentBox}>
        {activeTab === 'assets' && (
          <View>
            <Text style={styles.infoText}>Utilisez un son de démonstration embarqué dans l'application :</Text>
            <TouchableOpacity 
              style={styles.selectBtn} 
              onPress={() => {
                setSelectedAudio({ name: 'Demo_Violon.mp3', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' });
                setTransformedAudioUri(null);
              }}
            >
              <Text style={styles.selectBtnText}>Charger le son par défaut</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'records' && (
          <View>
            <Text style={styles.infoText}>Choisissez parmi vos enregistrements vocaux Redux :</Text>
            {records.length === 0 ? (
              <Text style={styles.emptyText}>Aucun enregistrement disponible. Allez sur l'onglet Enregistrer.</Text>
            ) : (
              <FlatList
                data={records}
                keyExtractor={(item) => item.id}
                scrollEnabled={false} // Intégré dans le ScrollView global
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[styles.audioRow, selectedAudio?.name === item.name && styles.audioRowSelected]}
                    onPress={() => {
                      setSelectedAudio({ name: item.name, uri: item.uri });
                      setTransformedAudioUri(null);
                    }}
                  >
                    <Text style={styles.audioRowText}>🎵 {item.name} ({item.timestamp})</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}

        {activeTab === 'local' && (
          <View>
            <Text style={styles.infoText}>Ouvrez l'explorateur de fichiers de votre système :</Text>
            <TouchableOpacity style={styles.selectBtn} onPress={pickLocalDocument}>
              <Text style={styles.selectBtnText}>📁 Parcourir le stockage</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 3. VISUALISATION DU FICHIER AUDIO SELECTIONNE */}
      {selectedAudio && (
        <View style={styles.selectedAudioBox}>
          <Text style={styles.selectedTitle}>Fichier sélectionné :</Text>
          <Text style={styles.selectedName}>📄 {selectedAudio.name}</Text>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.transformBtn]} 
            onPress={handleTransformAudio}
            disabled={isLoading}
          >
            <Text style={styles.actionBtnText}>⚡ TRANSFÉRER AU SERVEUR RAVE</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. WIDGET DE CALCUL ET DE CHARGEMENT */}
      {isLoading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{loadingMessage}</Text>
        </View>
      )}

      {/* 5. ZONE DE LECTURE COMPAREE DES DEUX PISTES */}
      {selectedAudio && (
        <View style={styles.playerContainer}>
          <Text style={styles.sectionTitle}>3. Comparaison d'écoute :</Text>
          <View style={styles.playerRow}>
            <TouchableOpacity 
              style={[styles.playButton, isPlayingOrig && styles.playButtonActive]} 
              onPress={() => handlePlayPause(selectedAudio.uri, false)}
            >
              <Text style={styles.playButtonText}>{isPlayingOrig ? '⏸ Original' : '▶️ Lire Original'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.playButton, styles.transformedPlayBtn, isPlayingTrans && styles.playButtonActive, !transformedAudioUri && styles.btnDisabled]} 
              onPress={() => transformedAudioUri && handlePlayPause(transformedAudioUri, true)}
              disabled={!transformedAudioUri}
            >
              <Text style={styles.playButtonText}>
                {transformedAudioUri ? (isPlayingTrans ? '⏸ RAVE' : '✨ Lire RAVE') : '❌ Non transformé'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9', padding: 15 },
  title: { fontSize: 22, fontWeight: 'bold', marginVertical: 15, textAlign: 'center', color: '#1a1a1a' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#444', marginTop: 15, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  modelsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  modelCard: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', elevation: 1 },
  modelCardSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  modelText: { fontSize: 14, color: '#333', fontWeight: '500' },
  modelTextSelected: { color: '#fff', fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: '#e0e0e0', borderRadius: 8, padding: 3, marginBottom: 12 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  tabButtonText: { fontSize: 13, fontWeight: '600', color: '#666' },
  tabButtonTextActive: { color: '#007AFF', fontWeight: '700' },
  tabContentBox: { backgroundColor: '#fff', borderRadius: 10, padding: 15, borderWidth: 1, borderColor: '#eee', minHeight: 90, justifyContent: 'center' },
  infoText: { fontSize: 13, color: '#666', marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 12, color: '#999', textAlign: 'center', fontStyle: 'italic' },
  selectBtn: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, alignItems: 'center' },
  selectBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  audioRow: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  audioRowSelected: { backgroundColor: '#e3f2fd', borderRadius: 6 },
  audioRowText: { fontSize: 13, color: '#333' },
  selectedAudioBox: { backgroundColor: '#eef9ff', borderRadius: 10, padding: 15, marginTop: 15, borderWidth: 1, borderColor: '#b3e5fc' },
  selectedTitle: { fontSize: 12, fontWeight: 'bold', color: '#0288d1', textTransform: 'uppercase' },
  selectedName: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 4, marginBottom: 15 },
  actionBtn: { padding: 14, borderRadius: 8, alignItems: 'center' },
  transformBtn: { backgroundColor: '#34C759' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },
  loadingBox: { alignItems: 'center', marginVertical: 20, backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  loadingText: { marginTop: 10, fontSize: 13, color: '#555', fontWeight: '500', textAlign: 'center' },
  playerContainer: { marginTop: 10 },
  playerRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  playButton: { flex: 1, backgroundColor: '#8e8e93', padding: 14, borderRadius: 8, alignItems: 'center' },
  transformedPlayBtn: { backgroundColor: '#af52de' },
  playButtonActive: { backgroundColor: '#ff9500' },
  playButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  btnDisabled: { backgroundColor: '#d1d1d6', opacity: 0.6 },
});