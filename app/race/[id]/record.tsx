import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  AppState,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '../../../utils/colors';
import { useGPSRecording } from '../../../hooks/useGPSRecording';
import { api } from '../../../services/api';
import type { RaceSession } from '../../../services/api';
import { TrackPreview } from '../../../components/TrackPreview';
import { getDraftTrack, setDraftTrack, clearDraftTrack } from '../../../utils/draftTrackStore';
import { getBackgroundLocationPoints } from '../../../tasks/backgroundLocation';
import {
  getPendingUploads,
  addPendingUpload,
  removePendingUpload,
  getPendingForRace,
  type PendingUpload,
} from '../../../utils/pendingUploadStore';
import { setActiveRecord, clearActiveRecord } from '../../../utils/activeRecordStore';
import {
  getRecoveryTrack,
  setRecoveryTrack,
  clearRecoveryTrack,
} from '../../../utils/recoveryTrackStore';

export default function RecordScreen() {
  const router = useRouter();
  const { id, participantName, raceName, isDirector: isDirectorParam } = useLocalSearchParams<{
    id: string;
    participantName: string;
    raceName: string;
    isDirector?: string;
  }>();
  const isDirector = isDirectorParam === '1';

  const { state, points, pointCount, error, startRecording, stopRecording, reset, loadDraft } =
    useGPSRecording();
  const highAccuracyGps = race?.gpsSampling === 'high';
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [race, setRace] = useState<RaceSession | null>(null);
  const [pendingForRace, setPendingForRace] = useState<PendingUpload[]>([]);
  const [retryingPending, setRetryingPending] = useState(false);

  useEffect(() => {
    if (id) {
      api.getRace(id).then(setRace).catch(() => {});
    } else {
      setRace(null);
    }
  }, [id]);

  // Restore recovered track when returning after app closed / phone died (racer or director).
  // Run before director draft effect so we can skip recovery when director has in-memory draft.
  useEffect(() => {
    if (!id) return;
    const hadDraft = isDirector && (getDraftTrack(id)?.length ?? 0) >= 2;
    getRecoveryTrack(id).then((recovery) => {
      if (!recovery || recovery.points.length < 2) return;
      if (hadDraft) return;
      loadDraft(recovery.points);
    });
  }, [id, isDirector, loadDraft]);

  // Restore director's draft track when they return (e.g. after "I'm racing too" -> left -> back)
  useEffect(() => {
    if (!id || !isDirector) return;
    const draft = getDraftTrack(id);
    if (draft && draft.length >= 2) {
      loadDraft(draft);
      clearDraftTrack(id);
    }
  }, [id, isDirector, loadDraft]);

  // Persist recovery when we have a track that isn't uploaded yet (so user can return after close/crash)
  useEffect(() => {
    if (!id || state !== 'stopped' || points.length < 2 || uploadSuccess) return;
    const timestampFallback = points.some(
      (p) => (p as { timestampFallback?: boolean }).timestampFallback,
    );
    setRecoveryTrack(id, {
      participantName: participantName ?? '',
      raceName: raceName ?? '',
      isDirector: isDirector || undefined,
      points: points.map(({ lat, lng, timestamp }) => ({ lat, lng, timestamp })),
      timestampFallback: timestampFallback || undefined,
    });
  }, [id, state, points, uploadSuccess, participantName, raceName, isDirector]);

  // When app goes to background, persist current points so recovery works if app is killed
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'background') return;
      if (!id) return;
      const hasTrack =
        (state === 'recording' && points.length >= 2) ||
        (state === 'stopped' && points.length >= 2 && !uploadSuccess && !uploadFailed);
      if (!hasTrack) return;
      const pts = points.map(({ lat, lng, timestamp }) => ({ lat, lng, timestamp }));
      const timestampFallback = points.some(
        (p) => (p as { timestampFallback?: boolean }).timestampFallback,
      );
      setRecoveryTrack(id, {
        participantName: participantName ?? '',
        raceName: raceName ?? '',
        isDirector: isDirector || undefined,
        points: pts,
        timestampFallback: timestampFallback || undefined,
      });
    });
    return () => sub.remove();
  }, [id, state, points, uploadSuccess, uploadFailed, participantName, raceName, isDirector]);

  // Clear recovery once upload succeeds so we don't prompt again
  useEffect(() => {
    if (id && uploadSuccess) {
      clearRecoveryTrack(id);
    }
  }, [id, uploadSuccess]);

  // Notify other screens that there's an active track (recording or not yet uploaded)
  useEffect(() => {
    const active =
      state === 'recording' ||
      (state === 'stopped' && !uploadSuccess && !uploadFailed && points.length >= 2);
    if (id && active) {
      setActiveRecord({
        raceId: id,
        participantName: participantName ?? '',
        raceName: raceName ?? '',
        ...(isDirector && { isDirector: true }),
      });
    } else {
      clearActiveRecord();
    }
  }, [id, state, uploadSuccess, uploadFailed, points.length, participantName, raceName, isDirector]);

  // Load pending uploads for this race; try to upload once when we have connection
  useEffect(() => {
    if (!id) return;
    getPendingUploads().then((all) => {
      const forRace = getPendingForRace(id, all);
      setPendingForRace(forRace);
      if (forRace.length > 0) {
        (async () => {
          for (const pending of forRace) {
            try {
              await api.uploadTrack(id, {
                participantName: pending.participantName,
                points: pending.points,
                ...(pending.timestampFallback && { timestampFallback: true }),
              });
              await removePendingUpload(pending.id);
              setPendingForRace((prev) => prev.filter((p) => p.id !== pending.id));
              setUploadSuccess(true);
            } catch {
              break;
            }
          }
        })();
      }
    });
  }, [id]);

  // Try to upload pending when screen is visible (e.g. user came back online)
  const tryPendingUploads = async () => {
    if (!id || pendingForRace.length === 0) return;
    setRetryingPending(true);
    for (const pending of [...pendingForRace]) {
      try {
        await api.uploadTrack(id, {
          participantName: pending.participantName,
          points: pending.points,
          ...(pending.timestampFallback && { timestampFallback: true }),
        });
        await removePendingUpload(pending.id);
        setPendingForRace((prev) => prev.filter((p) => p.id !== pending.id));
        setUploadSuccess(true);
      } catch {
        break;
      }
    }
    setRetryingPending(false);
  };


  const handleUpload = async () => {
    if (points.length < 2) {
      Alert.alert('Not enough data', 'Your track needs at least 2 GPS points.');
      return;
    }

    setUploading(true);
    setUploadSuccess(false);
    setUploadFailed(false);
    try {
      const timestampFallback = points.some(
        (p) => (p as { timestampFallback?: boolean }).timestampFallback,
      );
      await api.uploadTrack(id!, {
        participantName: participantName ?? 'Unknown',
        points: points.map(({ lat, lng, timestamp }) => ({ lat, lng, timestamp })),
        ...(timestampFallback && { timestampFallback: true }),
      });
      setUploadSuccess(true);
      setUploadFailed(false);
      reset();
    } catch (err) {
      setUploadFailed(true);
      const isLikelyNetwork =
        err instanceof Error &&
        (err.message?.toLowerCase().includes('network') ||
          err.message?.toLowerCase().includes('fetch') ||
          err.message?.toLowerCase().includes('failed to fetch'));
      if (isLikelyNetwork) {
        try {
          const timestampFallback = points.some(
            (p) => (p as { timestampFallback?: boolean }).timestampFallback,
          );
          await addPendingUpload(
            id!,
            participantName ?? 'Unknown',
            points.map(({ lat, lng, timestamp }) => ({ lat, lng, timestamp })),
            timestampFallback,
          );
          getPendingUploads().then((all) => setPendingForRace(getPendingForRace(id!, all)));
          Alert.alert(
            'Saved offline',
            'Your track was saved. When you have connection, tap "Retry upload" below or open this race again.',
            [{ text: 'OK' }],
          );
        } catch {
          Alert.alert(
            'Upload Failed',
            err instanceof Error ? err.message : 'Could not upload. Try again when online.',
            [{ text: 'OK' }],
          );
        }
      } else {
        Alert.alert(
          'Upload Failed',
          err instanceof Error
            ? err.message
            : 'Could not process your track. Make sure you crossed both start and finish.',
          [{ text: 'OK' }],
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleBack = async () => {
    const hasActiveTrack =
      state === 'recording' ||
      (state === 'stopped' && !uploadSuccess && !uploadFailed && points.length >= 2);
    if (!isDirector && hasActiveTrack) {
      Alert.alert(
        'Finish your race',
        'End tracking and upload your track before leaving, or your time won\'t be recorded.',
        [{ text: 'OK' }],
      );
      return;
    }
    if (isDirector && hasActiveTrack && id) {
      if (state === 'recording') {
        await stopRecording();
        setDraftTrack(
          id,
          getBackgroundLocationPoints().map((p) => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp })),
        );
      } else {
        setDraftTrack(
          id,
          points.map((p) => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp })),
        );
      }
    }
    router.replace('/');
  };

  const showBackButton = uploadSuccess || uploadFailed || isDirector;
  const hasActiveTrack =
    state === 'recording' ||
    (state === 'stopped' && !uploadSuccess && !uploadFailed && points.length >= 2);

  const handleViewResults = () => {
    if (!id) return;
    router.push({
      pathname: '/race/[id]/leaderboard',
      params: { id, participantName: participantName ?? '' },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        {showBackButton && (
          <Pressable style={styles.returnButton} onPress={handleBack}>
            <Text style={styles.returnButtonText}>← Back</Text>
          </Pressable>
        )}
        {isDirector && id && (
          <Pressable style={styles.viewResultsButton} onPress={handleViewResults}>
            <Text style={styles.viewResultsButtonText}>View results</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.header}>
        <Text style={styles.raceName}>{raceName}</Text>
        <Text style={styles.playerName}>{participantName}</Text>
      </View>

      {id && (
        <View style={styles.qrSection}>
          <Text style={styles.qrHint}>Share this race with others</Text>
          <View style={styles.qrContainer}>
            <QRCode
              value={`https://radtimer.com/join/${id}`}
              size={160}
              backgroundColor="white"
            />
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
      <View style={[styles.statusCard, state === 'stopped' && points.length >= 2 && !uploadFailed && styles.statusCardWithPreview]}>
        <Text style={styles.statusLabel}>
          {state === 'idle' && 'READY'}
          {state === 'recording' && 'TRACKING'}
          {state === 'stopped' && (uploadFailed ? 'UPLOAD FAILED' : 'TRACK RECORDED')}
        </Text>
        {state === 'stopped' && points.length >= 2 && !uploadFailed && (
          <>
            <Text style={styles.trackPreviewTitle}>Your track</Text>
            <View style={styles.trackPreviewBox}>
              <TrackPreview
                points={points}
                startLine={
                  race?.startLine ??
                  (race?.stages?.length ? race.stages[0].startLine : null) ??
                  null
                }
                finishLine={
                  race?.finishLine ??
                  (race?.stages?.length ? race.stages[race.stages.length - 1].finishLine : null) ??
                  null
                }
              />
            </View>
            <Text style={styles.trackHint}>
              Green = start line, red = finish line. Verify you crossed both.
            </Text>
          </>
        )}
        {state === 'stopped' && points.length < 2 && (
          <Text style={styles.trackHint}>
            Not enough points recorded. Try again with Start Tracking.
          </Text>
        )}
      </View>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={styles.settingsLink}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.settingsLinkText}>Open Settings</Text>
            </Pressable>
          </View>
        )}

        {uploadSuccess && (
          <View style={styles.successCard}>
            <Text style={styles.successText}>Uploaded! See your time below or race again.</Text>
          </View>
        )}

        {pendingForRace.length > 0 && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingText}>
              {pendingForRace.length} track{pendingForRace.length > 1 ? 's' : ''} saved offline.
            </Text>
            <Pressable
              style={[styles.retryButton, retryingPending && styles.buttonDisabled]}
              onPress={tryPendingUploads}
              disabled={retryingPending}
            >
              {retryingPending ? (
                <ActivityIndicator color={Colors.textOnPrimary} size="small" />
              ) : (
                <Text style={styles.retryButtonText}>Retry upload</Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.actions}>
        {state === 'idle' && !uploadSuccess && (
          <Pressable
            style={styles.startButton}
            onPress={() => {
              setUploadSuccess(false);
              setUploadFailed(false);
              startRecording(highAccuracyGps);
            }}
          >
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
            {uploadFailed && (
              <>
                <Pressable
                  style={styles.startButton}
                  onPress={() => {
                    setUploadFailed(false);
                    reset();
                  }}
                >
                  <Text style={styles.buttonText}>Start Tracking</Text>
                </Pressable>
                <Pressable
                  style={styles.backToRaceButton}
                  onPress={handleBack}
                >
                  <Text style={styles.backToRaceButtonText}>Back</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {uploadSuccess && (
          <>
            <Pressable
              style={styles.resultsButton}
              onPress={() =>
                router.push({
                  pathname: '/race/[id]/leaderboard',
                  params: { id: id!, participantName: participantName ?? '' },
                })
              }
            >
              <Text style={styles.buttonText}>See Results</Text>
            </Pressable>
            <Pressable
              style={styles.backToRaceButton}
              onPress={() => setUploadSuccess(false)}
            >
              <Text style={styles.backToRaceButtonText}>Back to race</Text>
            </Pressable>
          </>
        )}
      </View>
      </ScrollView>
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
  qrSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrHint: {
    fontSize: 13,
    color: Colors.textLight,
    marginBottom: 10,
  },
  qrContainer: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusCardWithPreview: {
    minHeight: 260,
  },
  trackPreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  trackPreviewBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    minHeight: 180,
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
  trackHint: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 10,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successText: {
    color: Colors.success,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  pendingCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  pendingText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  returnButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  returnButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  viewResultsButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  viewResultsButtonText: {
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
  resultsButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  backToRaceButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  backToRaceButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
});
