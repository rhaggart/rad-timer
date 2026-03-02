import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../utils/colors';
import { useGPSRecording } from '../../../hooks/useGPSRecording';
import { api } from '../../../services/api';

export default function RecordScreen() {
  const router = useRouter();
  const { id, participantName, raceName } = useLocalSearchParams<{
    id: string;
    participantName: string;
    raceName: string;
  }>();

  const { state, points, pointCount, error, startRecording, stopRecording, reset } =
    useGPSRecording();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (points.length < 2) {
      Alert.alert('Not enough data', 'Your track needs at least 2 GPS points.');
      return;
    }

    setUploading(true);
    try {
      await api.uploadTrack(id!, {
        participantName: participantName ?? 'Unknown',
        points,
      });
      router.replace({
        pathname: '/race/[id]/leaderboard',
        params: { id },
      });
    } catch (err) {
      Alert.alert(
        'Upload Failed',
        err instanceof Error
          ? err.message
          : 'Could not process your track. Make sure you crossed both start and finish.',
        [{ text: 'OK' }],
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.returnButton}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.returnButtonText}>← Return to Home</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.raceName}>{raceName}</Text>
        <Text style={styles.playerName}>{participantName}</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>
          {state === 'idle' && 'READY'}
          {state === 'recording' && 'RECORDING'}
          {state === 'stopped' && 'TRACK RECORDED'}
        </Text>
        <Text style={styles.pointCount}>
          {pointCount} GPS point{pointCount !== 1 ? 's' : ''}
        </Text>
        {state === 'recording' && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Tracking your location...</Text>
          </View>
        )}
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.settingsLink}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.settingsLinkText}>Open Settings to turn on location</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.actions}>
        {state === 'idle' && (
          <Pressable style={styles.startButton} onPress={startRecording}>
            <Text style={styles.buttonText}>Start Tracking</Text>
          </Pressable>
        )}

        {state === 'recording' && (
          <Pressable style={styles.stopButton} onPress={stopRecording}>
            <Text style={styles.buttonText}>End Tracking</Text>
          </Pressable>
        )}

        {state === 'stopped' && (
          <>
            <Pressable
              style={[styles.uploadButton, uploading && styles.buttonDisabled]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={Colors.textOnPrimary} />
              ) : (
                <Text style={styles.buttonText}>Upload Track for Results</Text>
              )}
            </Pressable>

            <Pressable style={styles.retryButton} onPress={reset}>
              <Text style={styles.retryButtonText}>Discard & Try Again</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  raceName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  playerName: {
    fontSize: 16,
    color: Colors.textLight,
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 3,
  },
  pointCount: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.text,
    marginTop: 8,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.finishRed,
  },
  recordingText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  settingsLink: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  settingsLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  returnButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  returnButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: Colors.startGreen,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: Colors.finishRed,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  retryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textLight,
  },
});
