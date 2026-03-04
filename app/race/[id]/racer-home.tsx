import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../../../utils/colors';
import { api } from '../../../services/api';
import type { RaceSession, LineSegment, StageSegment } from '../../../services/api';
import { getRecoveryTrack } from '../../../utils/recoveryTrackStore';
import { getPendingUploads, getPendingForRace } from '../../../utils/pendingUploadStore';

function lineToCoords(line: LineSegment) {
  return [
    { latitude: line.lat1, longitude: line.lng1 },
    { latitude: line.lat2, longitude: line.lng2 },
  ];
}

function getStartFinishLines(race: RaceSession | null): { start: LineSegment | null; finish: LineSegment | null } {
  if (!race) return { start: null, finish: null };
  const stages = race.stages as StageSegment[] | undefined;
  if (Array.isArray(stages) && stages.length > 0) {
    return {
      start: stages[0].startLine,
      finish: stages[stages.length - 1].finishLine,
    };
  }
  return { start: race.startLine ?? null, finish: race.finishLine ?? null };
}

function getBounds(
  race: RaceSession,
  userLat: number,
  userLng: number
): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
  const lats = [userLat];
  const lngs = [userLng];
  const { start, finish } = getStartFinishLines(race);
  if (start) {
    lats.push(start.lat1, start.lat2);
    lngs.push(start.lng1, start.lng2);
  }
  if (finish) {
    lats.push(finish.lat1, finish.lat2);
    lngs.push(finish.lng1, finish.lng2);
  }
  return {
    latMin: Math.min(...lats),
    latMax: Math.max(...lats),
    lngMin: Math.min(...lngs),
    lngMax: Math.max(...lngs),
  };
}

function boundsToRegion(
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number },
  padding = 1.5
): Region {
  const { latMin, latMax, lngMin, lngMax } = bounds;
  const latDelta = (latMax - latMin) * padding || 0.005;
  const lngDelta = (lngMax - lngMin) * padding || 0.005;
  const delta = Math.max(latDelta, lngDelta, 0.003);
  return {
    latitude: (latMin + latMax) / 2,
    longitude: (lngMin + lngMax) / 2,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

export default function RacerHomeScreen() {
  const router = useRouter();
  const { id, raceName } = useLocalSearchParams<{ id: string; raceName: string }>();
  const mapRef = useRef<MapView>(null);
  const [race, setRace] = useState<RaceSession | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [unfinishedTrack, setUnfinishedTrack] = useState<{
    participantName: string;
    raceName: string;
    isDirector: boolean;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let raceRes: RaceSession | null = null;
    (async () => {
      try {
        raceRes = await api.getRace(id);
        if (cancelled) return;
        setRace(raceRes);

        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          await Location.requestForegroundPermissionsAsync();
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const userLat = loc.coords.latitude;
        const userLng = loc.coords.longitude;
        const b = getBounds(raceRes, userLat, userLng);
        setRegion(boundsToRegion(b));
      } catch {
        if (!cancelled && raceRes) {
          const fallbackLat = raceRes.startCoords?.lat ?? raceRes.startLine?.lat1 ?? 0;
          const fallbackLng = raceRes.startCoords?.lng ?? raceRes.startLine?.lng1 ?? 0;
          setRegion(boundsToRegion(getBounds(raceRes, fallbackLat, fallbackLng)));
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const recovery = await getRecoveryTrack(id);
      if (recovery) {
        setUnfinishedTrack({
          participantName: recovery.participantName,
          raceName: recovery.raceName,
          isDirector: !!recovery.isDirector,
        });
        return;
      }
      const all = await getPendingUploads();
      const forRace = getPendingForRace(id, all);
      if (forRace.length > 0)
        setUnfinishedTrack({
          participantName: forRace[0].participantName,
          raceName: race?.name ?? raceName ?? '',
          isDirector: false,
        });
      else setUnfinishedTrack(null);
    })();
  }, [id, race?.name, raceName]);

  const { start, finish } = getStartFinishLines(race);
  const showMap = region && (start || finish);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Pressable style={styles.backButton} onPress={() => router.replace('/')}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.raceName}>{raceName ?? 'Race'}</Text>
        {showMap ? (
          <>
            <Text style={styles.mapLabel}>Course — get behind the green start line before starting</Text>
            <View style={styles.mapWrapper}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={region}
                showsUserLocation
                showsMyLocationButton
                mapType={Platform.OS === 'android' ? 'terrain' : 'hybrid'}
              >
                {start && (
                  <Polyline
                    coordinates={lineToCoords(start)}
                    strokeColor={Colors.startGreen}
                    strokeWidth={4}
                  />
                )}
                {finish && (
                  <Polyline
                    coordinates={lineToCoords(finish)}
                    strokeColor={Colors.finishRed}
                    strokeWidth={4}
                  />
                )}
              </MapView>
            </View>
            <View style={styles.legend}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: Colors.startGreen }]} />
                <Text style={styles.legendText}>Start</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: Colors.finishRed }]} />
                <Text style={styles.legendText}>Finish</Text>
              </View>
            </View>
          </>
        ) : mapLoading ? (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.mapPlaceholderText}>Loading course...</Text>
          </View>
        ) : null}
        <Text style={styles.hint}>You joined this race. Start tracking or view results.</Text>
        {unfinishedTrack && (
          <Pressable
            style={styles.uploadTrackButton}
            onPress={() =>
              router.push({
                pathname: '/race/[id]/record',
                params: {
                  id: id!,
                  participantName: unfinishedTrack.participantName,
                  raceName: unfinishedTrack.raceName,
                  isDirector: unfinishedTrack.isDirector ? '1' : '',
                },
              })
            }
          >
            <Text style={styles.uploadTrackButtonText}>Upload your track</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.push({
              pathname: '/racer/enter-name',
              params: { raceId: id, raceName },
            })
          }
        >
          <Text style={styles.buttonText}>Start Tracking</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            router.push({
              pathname: '/race/[id]/leaderboard',
              params: { id: id! },
            })
          }
        >
          <Text style={styles.secondaryButtonText}>See Results</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 16,
  },
  backButtonText: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 8,
  },
  raceName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  mapLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  mapWrapper: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    color: Colors.textLight,
  },
  mapPlaceholder: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: Colors.textLight,
  },
  hint: {
    fontSize: 15,
    color: Colors.textLight,
    marginBottom: 32,
  },
  uploadTrackButton: {
    backgroundColor: Colors.finishRed,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadTrackButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
});
