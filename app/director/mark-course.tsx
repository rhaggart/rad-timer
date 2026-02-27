import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Colors } from '../../utils/colors';
import { api } from '../../services/api';

export default function MarkCourseScreen() {
  const router = useRouter();
  const { raceName, expiryHours } = useLocalSearchParams<{
    raceName: string;
    expiryHours: string;
  }>();

  const [region, setRegion] = useState<Region | null>(null);
  const [startCoords, setStartCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [finishCoords, setFinishCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;

      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      setStartCoords({ lat: latitude - 0.001, lng: longitude });
      setFinishCoords({ lat: latitude + 0.001, lng: longitude });
    })();
  }, []);

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

  return (
    <View style={styles.container}>
      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          Drag the pins to set the start and finish lines
        </Text>
      </View>

      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation
      >
        {startCoords && (
          <Marker
            coordinate={{
              latitude: startCoords.lat,
              longitude: startCoords.lng,
            }}
            draggable
            onDragEnd={(e) =>
              setStartCoords({
                lat: e.nativeEvent.coordinate.latitude,
                lng: e.nativeEvent.coordinate.longitude,
              })
            }
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
            draggable
            onDragEnd={(e) =>
              setFinishCoords({
                lat: e.nativeEvent.coordinate.latitude,
                lng: e.nativeEvent.coordinate.longitude,
              })
            }
            pinColor={Colors.finishRed}
            title="Finish"
          />
        )}
      </MapView>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.startGreen }]} />
          <Text style={styles.legendLabel}>Start</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.finishRed }]} />
          <Text style={styles.legendLabel}>Finish</Text>
        </View>
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
  legend: {
    position: 'absolute',
    top: 56,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
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
