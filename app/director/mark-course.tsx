import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../../utils/colors';
import { api } from '../../services/api';

function formatCoord(value: number, type: 'lat' | 'lng'): string {
  const deg = Math.abs(value).toFixed(5);
  const dir = type === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${deg}° ${dir}`;
}

export default function MarkCourseScreen() {
  const router = useRouter();
  const { raceName, expiryHours } = useLocalSearchParams<{
    raceName: string;
    expiryHours: string;
  }>();

  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [startCoords, setStartCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [finishCoords, setFinishCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [creating, setCreating] = useState(false);

  // Initial region + live GPS updates
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
    if (currentLocation) setStartCoords({ ...currentLocation });
  };

  const captureFinish = () => {
    if (currentLocation) setFinishCoords({ ...currentLocation });
  };

  const canCreate = startCoords && finishCoords;

  const handleCreate = async () => {
    if (!startCoords || !finishCoords) return;
    setCreating(true);
    try {
      const race = await api.createRace({
        name: raceName ?? 'Unnamed Race',
        startCoords,
        finishCoords,
        expiryHours: Number(expiryHours) || 4,
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

  // Terrain/topo: Android has "terrain"; iOS uses "hybrid" (satellite + labels) for outdoor
  const mapType = Platform.OS === 'android' ? 'terrain' : 'hybrid';

  return (
    <View style={styles.container}>
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Move to each spot, then tap Create Start and Create Finish
        </Text>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
        mapType={mapType}
        followsUserLocation
      >
        {startCoords && (
          <Marker
            coordinate={{
              latitude: startCoords.lat,
              longitude: startCoords.lng,
            }}
            pinColor={Colors.startGreen}
            title="Start"
          />
        )}
        {finishCoords && (
          <Marker
            coordinate={{
              latitude: finishCoords.lat,
              longitude: finishCoords.lng,
            }}
            pinColor={Colors.finishRed}
            title="Finish"
          />
        )}
      </MapView>

      {/* Live GPS coordinates */}
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

      {/* Start / Finish coordinates when set */}
      {(startCoords || finishCoords) && (
        <View style={styles.capturedOverlay}>
          {startCoords && (
            <View style={styles.capturedRow}>
              <View style={[styles.capturedDot, { backgroundColor: Colors.startGreen }]} />
              <Text style={styles.capturedLabel}>Start: </Text>
              <Text style={styles.capturedCoords} numberOfLines={1}>
                {formatCoord(startCoords.lat, 'lat')}, {formatCoord(startCoords.lng, 'lng')}
              </Text>
            </View>
          )}
          {finishCoords && (
            <View style={styles.capturedRow}>
              <View style={[styles.capturedDot, { backgroundColor: Colors.finishRed }]} />
              <Text style={styles.capturedLabel}>Finish: </Text>
              <Text style={styles.capturedCoords} numberOfLines={1}>
                {formatCoord(finishCoords.lat, 'lat')}, {formatCoord(finishCoords.lng, 'lng')}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.buttons}>
        <Pressable
          style={[styles.captureButton, styles.startButton]}
          onPress={captureStart}
          disabled={!currentLocation}
        >
          <Text style={styles.captureButtonText}>Create Start</Text>
        </Pressable>
        <Pressable
          style={[styles.captureButton, styles.finishButton]}
          onPress={captureFinish}
          disabled={!currentLocation}
        >
          <Text style={styles.captureButtonText}>Create Finish</Text>
        </Pressable>
      </View>

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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnPrimary,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.background,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
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
