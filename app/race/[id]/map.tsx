import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Polyline, Region, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../../../utils/colors';
import { api } from '../../../services/api';
import type { RaceSession, LineSegment, StageSegment } from '../../../services/api';

function lineToCoords(line: LineSegment) {
  return [
    { latitude: line.lat1, longitude: line.lng1 },
    { latitude: line.lat2, longitude: line.lng2 },
  ];
}

function getBounds(
  race: RaceSession,
  userLat: number,
  userLng: number
): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
  const lats: number[] = [userLat];
  const lngs: number[] = [userLng];
  if (race.startLine) {
    lats.push(race.startLine.lat1, race.startLine.lat2);
    lngs.push(race.startLine.lng1, race.startLine.lng2);
  }
  if (race.finishLine) {
    lats.push(race.finishLine.lat1, race.finishLine.lat2);
    lngs.push(race.finishLine.lng1, race.finishLine.lng2);
  }
  const stages = race.stages as StageSegment[] | undefined;
  if (Array.isArray(stages)) {
    stages.forEach((s) => {
      lats.push(s.startLine.lat1, s.startLine.lat2, s.finishLine.lat1, s.finishLine.lat2);
      lngs.push(s.startLine.lng1, s.startLine.lng2, s.finishLine.lng1, s.finishLine.lng2);
    });
  }
  if (race.startCoords) {
    lats.push(race.startCoords.lat);
    lngs.push(race.startCoords.lng);
  }
  if (race.finishCoords) {
    lats.push(race.finishCoords.lat);
    lngs.push(race.finishCoords.lng);
  }
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs);
  const lngMax = Math.max(...lngs);
  return { latMin, latMax, lngMin, lngMax };
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

export default function RaceMapScreen() {
  const router = useRouter();
  const { id, raceName } = useLocalSearchParams<{ id: string; raceName: string }>();
  const mapRef = useRef<MapView>(null);
  const [race, setRace] = useState<RaceSession | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const raceRes = await api.getRace(id);
        if (cancelled) return;
        setRace(raceRes);

        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const { status: requested } = await Location.requestForegroundPermissionsAsync();
          if (cancelled) return;
          if (requested !== 'granted') {
            const b = getBounds(raceRes, raceRes.startCoords?.lat ?? 0, raceRes.startCoords?.lng ?? 0);
            setRegion(boundsToRegion(b));
            setLoading(false);
            return;
          }
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const userLat = loc.coords.latitude;
        const userLng = loc.coords.longitude;
        setUserLocation({ latitude: userLat, longitude: userLng });
        const b = getBounds(raceRes, userLat, userLng);
        setRegion(boundsToRegion(b));
      } catch {
        if (!cancelled && raceRes) {
          const fallbackLat = raceRes.startCoords?.lat ?? 0;
          const fallbackLng = raceRes.startCoords?.lng ?? 0;
          setRegion(boundsToRegion(getBounds(raceRes, fallbackLat, fallbackLng)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleBackToShare = () => {
    router.replace({
      pathname: '/race/[id]/invite',
      params: { id, raceName },
    });
  };

  if (loading || !race) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  const hasStages = Array.isArray(race.stages) && race.stages.length > 0;
  const singleStart = race.startLine;
  const singleFinish = race.finishLine;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{raceName ?? 'Race'} — on map</Text>
        <Pressable style={styles.backButton} onPress={handleBackToShare}>
          <Text style={styles.backButtonText}>← Back to share</Text>
        </Pressable>
      </View>
      {region && (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={false}
          mapType={Platform.OS === 'android' ? 'terrain' : 'hybrid'}
        >
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title="You are here"
              pinColor={Colors.primary}
            />
          )}
          {hasStages &&
            (race.stages as StageSegment[]).map((stage, i) => (
              <React.Fragment key={i}>
                <Polyline
                  coordinates={lineToCoords(stage.startLine)}
                  strokeColor={Colors.startGreen}
                  strokeWidth={4}
                />
                <Polyline
                  coordinates={lineToCoords(stage.finishLine)}
                  strokeColor={Colors.finishRed}
                  strokeWidth={4}
                />
              </React.Fragment>
            ))}
          {!hasStages && singleStart && (
            <Polyline
              coordinates={lineToCoords(singleStart)}
              strokeColor={Colors.startGreen}
              strokeWidth={4}
            />
          )}
          {!hasStages && singleFinish && (
            <Polyline
              coordinates={lineToCoords(singleFinish)}
              strokeColor={Colors.finishRed}
              strokeWidth={4}
            />
          )}
        </MapView>
      )}
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Colors.startGreen }]} />
          <Text style={styles.legendText}>Start line(s)</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: Colors.finishRed }]} />
          <Text style={styles.legendText}>Finish line(s)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textLight,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  map: {
    flex: 1,
    width: '100%',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendText: {
    fontSize: 13,
    color: Colors.textLight,
  },
});
