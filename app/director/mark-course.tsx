import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../../utils/colors';
import { segmentFromCenter } from '../../utils/geo';
import type { LineSegment } from '../../services/api';
import { api } from '../../services/api';

const DEFAULT_ANGLE = 90;
const DEFAULT_LENGTH_METERS = 15;
const MIN_LENGTH = 5;
const MAX_LENGTH = 50;
const ANGLE_STEP = 15;
const LENGTH_STEP = 1;

function formatCoord(value: number, type: 'lat' | 'lng'): string {
  const deg = Math.abs(value).toFixed(5);
  const dir = type === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${deg}° ${dir}`;
}

export default function MarkCourseScreen() {
  const router = useRouter();
  const { raceName, durationHours } = useLocalSearchParams<{
    raceName: string;
    durationHours: string;
  }>();

  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [startCenter, setStartCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [finishCenter, setFinishCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [startAngle, setStartAngle] = useState(DEFAULT_ANGLE);
  const [startLengthMeters, setStartLengthMeters] = useState(DEFAULT_LENGTH_METERS);
  const [finishAngle, setFinishAngle] = useState(DEFAULT_ANGLE);
  const [finishLengthMeters, setFinishLengthMeters] = useState(DEFAULT_LENGTH_METERS);
  const [creating, setCreating] = useState(false);

  const startLine: LineSegment | null =
    startCenter
      ? segmentFromCenter(startCenter, startAngle, startLengthMeters)
      : null;
  const finishLine: LineSegment | null =
    finishCenter
      ? segmentFromCenter(finishCenter, finishAngle, finishLengthMeters)
      : null;

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const { latitude, longitude } = loc.coords;

      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      setCurrentLocation({ lat: latitude, lng: longitude });

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 5,
        },
        (location) => {
          setCurrentLocation({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, []);

  const captureStart = () => {
    if (currentLocation) {
      setStartCenter({ ...currentLocation });
      setStartAngle(DEFAULT_ANGLE);
      setStartLengthMeters(DEFAULT_LENGTH_METERS);
    }
  };

  const captureFinish = () => {
    if (currentLocation) {
      setFinishCenter({ ...currentLocation });
      setFinishAngle(DEFAULT_ANGLE);
      setFinishLengthMeters(DEFAULT_LENGTH_METERS);
    }
  };

  const canCreate = startLine && finishLine;

  const handleCreate = async () => {
    if (!startLine || !finishLine || !startCenter || !finishCenter) return;
    setCreating(true);
    try {
      const race = await api.createRace({
        name: raceName ?? 'Unnamed Race',
        startLine,
        finishLine,
        startCoords: startCenter,
        finishCoords: finishCenter,
        durationHours: Number(durationHours) || 24,
      });
      router.replace({
        pathname: '/race/[id]/invite',
        params: { id: race.raceId, raceName: race.name },
      });
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Failed to create race',
      );
    } finally {
      setCreating(false);
    }
  };

  if (!region) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  const mapType = Platform.OS === 'android' ? 'terrain' : 'hybrid';

  return (
    <View style={styles.container}>
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Move to each spot, tap Create Start and Create Finish, then adjust angle and length
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          showsUserLocation
          showsMyLocationButton
          mapType={mapType}
          followsUserLocation
        >
          {startCenter && (
            <Marker
              coordinate={{
                latitude: startCenter.lat,
                longitude: startCenter.lng,
              }}
              pinColor={Colors.startGreen}
              title="Start"
            />
          )}
          {finishCenter && (
            <Marker
              coordinate={{
                latitude: finishCenter.lat,
                longitude: finishCenter.lng,
              }}
              pinColor={Colors.finishRed}
              title="Finish"
            />
          )}
          {startLine && (
            <Polyline
              coordinates={[
                { latitude: startLine.lat1, longitude: startLine.lng1 },
                { latitude: startLine.lat2, longitude: startLine.lng2 },
              ]}
              strokeColor={Colors.startGreen}
              strokeWidth={4}
            />
          )}
          {finishLine && (
            <Polyline
              coordinates={[
                { latitude: finishLine.lat1, longitude: finishLine.lng1 },
                { latitude: finishLine.lat2, longitude: finishLine.lng2 },
              ]}
              strokeColor={Colors.finishRed}
              strokeWidth={4}
            />
          )}
        </MapView>

        <View style={styles.coordOverlay}>
          <Text style={styles.coordTitle}>Your location</Text>
          {currentLocation ? (
            <Text style={styles.coordText} numberOfLines={1}>
              {formatCoord(currentLocation.lat, 'lat')}, {formatCoord(currentLocation.lng, 'lng')}
            </Text>
          ) : (
            <Text style={styles.coordText}>—</Text>
          )}
        </View>

        {(startCenter || finishCenter) && (
          <View style={styles.capturedOverlay}>
            {startCenter && (
              <View style={styles.capturedRow}>
                <View style={[styles.capturedDot, { backgroundColor: Colors.startGreen }]} />
                <Text style={styles.capturedLabel}>Start: </Text>
                <Text style={styles.capturedCoords} numberOfLines={1}>
                  {formatCoord(startCenter.lat, 'lat')}, {formatCoord(startCenter.lng, 'lng')}
                </Text>
              </View>
            )}
            {finishCenter && (
              <View style={styles.capturedRow}>
                <View style={[styles.capturedDot, { backgroundColor: Colors.finishRed }]} />
                <Text style={styles.capturedLabel}>Finish: </Text>
                <Text style={styles.capturedCoords} numberOfLines={1}>
                  {formatCoord(finishCenter.lat, 'lat')}, {formatCoord(finishCenter.lng, 'lng')}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.adjustPanel}
        contentContainerStyle={styles.adjustPanelContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.lineControls}>
          <Pressable
            style={[styles.captureButton, styles.startButton, styles.captureButtonInPanel]}
            onPress={captureStart}
            disabled={!currentLocation}
          >
            <Text style={styles.captureButtonText}>Create Start</Text>
          </Pressable>
          {startCenter && (
            <>
              <Text style={styles.lineControlsTitle}>Start line</Text>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Angle:</Text>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => setStartAngle((a) => Math.max(0, a - ANGLE_STEP))}
                  >
                    <Text style={styles.stepperButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{startAngle}°</Text>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => setStartAngle((a) => Math.min(360, a + ANGLE_STEP))}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Length:</Text>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() =>
                      setStartLengthMeters((l) => Math.max(MIN_LENGTH, l - LENGTH_STEP))
                    }
                  >
                    <Text style={styles.stepperButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{startLengthMeters} m</Text>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() =>
                      setStartLengthMeters((l) => Math.min(MAX_LENGTH, l + LENGTH_STEP))
                    }
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
        <View style={styles.lineControls}>
          <Pressable
            style={[styles.captureButton, styles.finishButton, styles.captureButtonInPanel]}
            onPress={captureFinish}
            disabled={!currentLocation}
          >
            <Text style={styles.captureButtonText}>Create Finish</Text>
          </Pressable>
          {finishCenter && (
            <>
              <Text style={styles.lineControlsTitle}>Finish line</Text>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Angle:</Text>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => setFinishAngle((a) => Math.max(0, a - ANGLE_STEP))}
                  >
                    <Text style={styles.stepperButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{finishAngle}°</Text>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() => setFinishAngle((a) => Math.min(360, a + ANGLE_STEP))}
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.stepperRow}>
                <Text style={styles.stepperLabel}>Length:</Text>
                <View style={styles.stepper}>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() =>
                      setFinishLengthMeters((l) => Math.max(MIN_LENGTH, l - LENGTH_STEP))
                    }
                  >
                    <Text style={styles.stepperButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{finishLengthMeters} m</Text>
                  <Pressable
                    style={styles.stepperButton}
                    onPress={() =>
                      setFinishLengthMeters((l) => Math.min(MAX_LENGTH, l + LENGTH_STEP))
                    }
                  >
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.createButton,
            (!canCreate || creating) && styles.createButtonDisabled,
          ]}
          onPress={handleCreate}
          disabled={!canCreate || creating}
        >
          {creating ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.createButtonText}>Create Race</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textLight,
  },
  instructions: {
    backgroundColor: Colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  instructionText: {
    color: Colors.textOnSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  coordOverlay: {
    position: 'absolute',
    top: 56,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    padding: 10,
  },
  coordTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coordText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    color: '#fff',
  },
  capturedOverlay: {
    position: 'absolute',
    top: 120,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  capturedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capturedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  capturedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  capturedCoords: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    color: Colors.textLight,
    flex: 1,
  },
  adjustPanel: {
    backgroundColor: Colors.background,
    maxHeight: 280,
  },
  adjustPanelContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  lineControls: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    padding: 6,
  },
  captureButtonInPanel: {
    flex: undefined,
    marginBottom: 6,
    paddingVertical: 8,
  },
  lineControlsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 3,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  stepperLabel: {
    fontSize: 11,
    color: Colors.textLight,
    width: 44,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  stepperValue: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    color: Colors.text,
    minWidth: 36,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  captureButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: Colors.startGreen,
  },
  finishButton: {
    backgroundColor: Colors.finishRed,
  },
  captureButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  footer: {
    padding: 12,
    paddingBottom: 24,
    backgroundColor: Colors.background,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.4,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
});
