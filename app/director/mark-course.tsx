import React, { useState, useEffect, useRef } from 'react';
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
import type { LineSegment, StageSegment } from '../../services/api';
import { api } from '../../services/api';
import { addCreatedRaceId } from '../../utils/myRacesStore';

const DEFAULT_ANGLE = 90;
type Coord = { lat: number; lng: number };
interface StageState {
  startCenter: Coord | null;
  startAngle: number;
  startLengthMeters: number;
  finishCenter: Coord | null;
  finishAngle: number;
  finishLengthMeters: number;
}
const emptyStage = (): StageState => ({
  startCenter: null,
  startAngle: DEFAULT_ANGLE,
  startLengthMeters: DEFAULT_LENGTH_METERS,
  finishCenter: null,
  finishAngle: DEFAULT_ANGLE,
  finishLengthMeters: DEFAULT_LENGTH_METERS,
});
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
  const { raceName, durationHours, plan: planParam, gpsSampling } = useLocalSearchParams<{
    raceName: string;
    durationHours: string;
    plan?: string;
    gpsSampling?: string;
  }>();
  const isPaid = planParam === 'paid';

  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coord | null>(null);
  const [startCenter, setStartCenter] = useState<Coord | null>(null);
  const [finishCenter, setFinishCenter] = useState<Coord | null>(null);
  const [startAngle, setStartAngle] = useState(DEFAULT_ANGLE);
  const [startLengthMeters, setStartLengthMeters] = useState(DEFAULT_LENGTH_METERS);
  const [finishAngle, setFinishAngle] = useState(DEFAULT_ANGLE);
  const [finishLengthMeters, setFinishLengthMeters] = useState(DEFAULT_LENGTH_METERS);
  const [creating, setCreating] = useState(false);
  const [stages, setStages] = useState<StageState[]>(() =>
    isPaid ? [emptyStage()] : [],
  );

  const startLine: LineSegment | null =
    startCenter
      ? segmentFromCenter(startCenter, startAngle, startLengthMeters)
      : null;
  const finishLine: LineSegment | null =
    finishCenter
      ? segmentFromCenter(finishCenter, finishAngle, finishLengthMeters)
      : null;

  const stageSegments: (StageSegment | null)[] = stages.map((s) => {
    if (!s.startCenter || !s.finishCenter) return null;
    return {
      startLine: segmentFromCenter(s.startCenter, s.startAngle, s.startLengthMeters),
      finishLine: segmentFromCenter(s.finishCenter, s.finishAngle, s.finishLengthMeters),
    };
  });
  const allStagesComplete =
    isPaid &&
    stages.length > 0 &&
    stageSegments.every((s) => s != null);
  const canCreateMultiStage = allStagesComplete;
  const canCreateSingle = !isPaid && startLine && finishLine && startCenter && finishCenter;
  const canCreate = isPaid ? canCreateMultiStage : canCreateSingle;

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

  // When finish line is first set, fit map to both lines so the red line appears immediately
  useEffect(() => {
    if (!isPaid && finishLine && startLine && mapRef.current) {
      const coords = [
        { latitude: startLine.lat1, longitude: startLine.lng1 },
        { latitude: startLine.lat2, longitude: startLine.lng2 },
        { latitude: finishLine.lat1, longitude: finishLine.lng1 },
        { latitude: finishLine.lat2, longitude: finishLine.lng2 },
      ];
      mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
    }
  }, [isPaid, finishLine, startLine]);

  const captureStageStart = (idx: number) => {
    if (currentLocation) {
      setStages((prev) => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          startCenter: { ...currentLocation },
          startAngle: DEFAULT_ANGLE,
          startLengthMeters: DEFAULT_LENGTH_METERS,
        };
        return next;
      });
    }
  };
  const captureStageFinish = (idx: number) => {
    if (currentLocation) {
      setStages((prev) => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          finishCenter: { ...currentLocation },
          finishAngle: DEFAULT_ANGLE,
          finishLengthMeters: DEFAULT_LENGTH_METERS,
        };
        return next;
      });
    }
  };
  const addStage = () => {
    setStages((prev) => [...prev, emptyStage()]);
  };
  const updateStageStartAngle = (idx: number, delta: number) => {
    setStages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], startAngle: Math.max(0, Math.min(360, next[idx].startAngle + delta)) };
      return next;
    });
  };
  const updateStageStartLength = (idx: number, delta: number) => {
    setStages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], startLengthMeters: Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, next[idx].startLengthMeters + delta)) };
      return next;
    });
  };
  const updateStageFinishAngle = (idx: number, delta: number) => {
    setStages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], finishAngle: Math.max(0, Math.min(360, next[idx].finishAngle + delta)) };
      return next;
    });
  };
  const updateStageFinishLength = (idx: number, delta: number) => {
    setStages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], finishLengthMeters: Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, next[idx].finishLengthMeters + delta)) };
      return next;
    });
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      if (isPaid && allStagesComplete && stageSegments.every(Boolean)) {
        const segs = stageSegments as StageSegment[];
        const race = await api.createRace({
          name: raceName ?? 'Unnamed Race',
          plan: 'paid',
          durationHours: Number(durationHours) || 24,
          stages: segs,
          gpsSampling: gpsSampling === 'high' ? 'high' : 'standard',
        });
        await addCreatedRaceId(race.raceId);
        router.replace({
          pathname: '/race/[id]/invite',
          params: { id: race.raceId, raceName: race.name },
        });
      } else if (!isPaid && startLine && finishLine && startCenter && finishCenter) {
        const race = await api.createRace({
          name: raceName ?? 'Unnamed Race',
          startLine,
          finishLine,
          startCoords: startCenter,
          finishCoords: finishCenter,
          durationHours: Number(durationHours) || 24,
          plan: 'free',
          gpsSampling: gpsSampling === 'high' ? 'high' : 'standard',
        });
        await addCreatedRaceId(race.raceId);
        router.replace({
          pathname: '/race/[id]/invite',
          params: { id: race.raceId, raceName: race.name },
        });
      }
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
          {isPaid
            ? 'Add stages: for each stage tap Create Stage N Start and Create Stage N Finish, then adjust. Use "Create another stage" for more.'
            : 'Move to each spot, tap Create Start and Create Finish, then adjust angle and length'}
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
          {!isPaid && startCenter && (
            <Marker
              coordinate={{ latitude: startCenter.lat, longitude: startCenter.lng }}
              pinColor={Colors.startGreen}
              title="Start"
            />
          )}
          {!isPaid && finishCenter && (
            <Marker
              coordinate={{ latitude: finishCenter.lat, longitude: finishCenter.lng }}
              pinColor={Colors.finishRed}
              title="Finish"
            />
          )}
          {isPaid &&
            stages.map((s, i) => (
              <React.Fragment key={i}>
                {s.startCenter && (
                  <Marker
                    coordinate={{ latitude: s.startCenter.lat, longitude: s.startCenter.lng }}
                    pinColor={Colors.startGreen}
                    title={`Stage ${i + 1} Start`}
                  />
                )}
                {s.finishCenter && (
                  <Marker
                    coordinate={{ latitude: s.finishCenter.lat, longitude: s.finishCenter.lng }}
                    pinColor={Colors.finishRed}
                    title={`Stage ${i + 1} Finish`}
                  />
                )}
                {s.startCenter &&
                  (() => {
                    const line = segmentFromCenter(s.startCenter, s.startAngle, s.startLengthMeters);
                    return (
                      <Polyline
                        key={`s${i}`}
                        coordinates={[
                          { latitude: line.lat1, longitude: line.lng1 },
                          { latitude: line.lat2, longitude: line.lng2 },
                        ]}
                        strokeColor={Colors.startGreen}
                        strokeWidth={4}
                      />
                    );
                  })()}
                {s.finishCenter &&
                  (() => {
                    const line = segmentFromCenter(s.finishCenter, s.finishAngle, s.finishLengthMeters);
                    return (
                      <Polyline
                        key={`f${i}`}
                        coordinates={[
                          { latitude: line.lat1, longitude: line.lng1 },
                          { latitude: line.lat2, longitude: line.lng2 },
                        ]}
                        strokeColor={Colors.finishRed}
                        strokeWidth={4}
                      />
                    );
                  })()}
              </React.Fragment>
            ))}
          {!isPaid && startLine && (
            <Polyline
              key={`start-${startCenter?.lat}-${startCenter?.lng}-${startAngle}-${startLengthMeters}`}
              coordinates={[
                { latitude: startLine.lat1, longitude: startLine.lng1 },
                { latitude: startLine.lat2, longitude: startLine.lng2 },
              ]}
              strokeColor={Colors.startGreen}
              strokeWidth={4}
            />
          )}
          {!isPaid && finishLine && (
            <Polyline
              key={`finish-${finishCenter?.lat}-${finishCenter?.lng}-${finishAngle}-${finishLengthMeters}`}
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

        {(!isPaid && (startCenter || finishCenter)) && (
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
        {isPaid ? (
          <>
            {stages.map((stage, idx) => (
              <View key={idx} style={styles.stageBlock}>
                <Text style={styles.stageBlockTitle}>Stage {idx + 1}</Text>
                <View style={styles.lineControls}>
                  <Pressable
                    style={[styles.captureButton, styles.startButton, styles.captureButtonInPanel]}
                    onPress={() => captureStageStart(idx)}
                    disabled={!currentLocation}
                  >
                    <Text style={styles.captureButtonText}>Create Stage {idx + 1} Start</Text>
                  </Pressable>
                  {stage.startCenter && (
                    <>
                      <Text style={styles.lineControlsTitle}>Start line</Text>
                      <View style={styles.stepperRow}>
                        <Text style={styles.stepperLabel}>Angle:</Text>
                        <View style={styles.stepper}>
                          <Pressable style={styles.stepperButton} onPress={() => updateStageStartAngle(idx, -ANGLE_STEP)}>
                            <Text style={styles.stepperButtonText}>−</Text>
                          </Pressable>
                          <Text style={styles.stepperValue}>{stage.startAngle}°</Text>
                          <Pressable style={styles.stepperButton} onPress={() => updateStageStartAngle(idx, ANGLE_STEP)}>
                            <Text style={styles.stepperButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                      <View style={styles.stepperRow}>
                        <Text style={styles.stepperLabel}>Length:</Text>
                        <View style={styles.stepper}>
                          <Pressable style={styles.stepperButton} onPress={() => updateStageStartLength(idx, -LENGTH_STEP)}>
                            <Text style={styles.stepperButtonText}>−</Text>
                          </Pressable>
                          <Text style={styles.stepperValue}>{stage.startLengthMeters} m</Text>
                          <Pressable style={styles.stepperButton} onPress={() => updateStageStartLength(idx, LENGTH_STEP)}>
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
                    onPress={() => captureStageFinish(idx)}
                    disabled={!currentLocation}
                  >
                    <Text style={styles.captureButtonText}>Create Stage {idx + 1} Finish</Text>
                  </Pressable>
                  {stage.finishCenter && (
                    <>
                      <Text style={styles.lineControlsTitle}>Finish line</Text>
                      <View style={styles.stepperRow}>
                        <Text style={styles.stepperLabel}>Angle:</Text>
                        <View style={styles.stepper}>
                          <Pressable style={styles.stepperButton} onPress={() => updateStageFinishAngle(idx, -ANGLE_STEP)}>
                            <Text style={styles.stepperButtonText}>−</Text>
                          </Pressable>
                          <Text style={styles.stepperValue}>{stage.finishAngle}°</Text>
                          <Pressable style={styles.stepperButton} onPress={() => updateStageFinishAngle(idx, ANGLE_STEP)}>
                            <Text style={styles.stepperButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                      <View style={styles.stepperRow}>
                        <Text style={styles.stepperLabel}>Length:</Text>
                        <View style={styles.stepper}>
                          <Pressable style={styles.stepperButton} onPress={() => updateStageFinishLength(idx, -LENGTH_STEP)}>
                            <Text style={styles.stepperButtonText}>−</Text>
                          </Pressable>
                          <Text style={styles.stepperValue}>{stage.finishLengthMeters} m</Text>
                          <Pressable style={styles.stepperButton} onPress={() => updateStageFinishLength(idx, LENGTH_STEP)}>
                            <Text style={styles.stepperButtonText}>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              </View>
            ))}
            <Pressable style={styles.addStageButton} onPress={addStage}>
              <Text style={styles.addStageButtonText}>Create another stage</Text>
            </Pressable>
          </>
        ) : (
          <>
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
                      <Pressable style={styles.stepperButton} onPress={() => setStartAngle((a) => Math.max(0, a - ANGLE_STEP))}>
                        <Text style={styles.stepperButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepperValue}>{startAngle}°</Text>
                      <Pressable style={styles.stepperButton} onPress={() => setStartAngle((a) => Math.min(360, a + ANGLE_STEP))}>
                        <Text style={styles.stepperButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.stepperRow}>
                    <Text style={styles.stepperLabel}>Length:</Text>
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepperButton} onPress={() => setStartLengthMeters((l) => Math.max(MIN_LENGTH, l - LENGTH_STEP))}>
                        <Text style={styles.stepperButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepperValue}>{startLengthMeters} m</Text>
                      <Pressable style={styles.stepperButton} onPress={() => setStartLengthMeters((l) => Math.min(MAX_LENGTH, l + LENGTH_STEP))}>
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
                      <Pressable style={styles.stepperButton} onPress={() => setFinishAngle((a) => Math.max(0, a - ANGLE_STEP))}>
                        <Text style={styles.stepperButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepperValue}>{finishAngle}°</Text>
                      <Pressable style={styles.stepperButton} onPress={() => setFinishAngle((a) => Math.min(360, a + ANGLE_STEP))}>
                        <Text style={styles.stepperButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.stepperRow}>
                    <Text style={styles.stepperLabel}>Length:</Text>
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepperButton} onPress={() => setFinishLengthMeters((l) => Math.max(MIN_LENGTH, l - LENGTH_STEP))}>
                        <Text style={styles.stepperButtonText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepperValue}>{finishLengthMeters} m</Text>
                      <Pressable style={styles.stepperButton} onPress={() => setFinishLengthMeters((l) => Math.min(MAX_LENGTH, l + LENGTH_STEP))}>
                        <Text style={styles.stepperButtonText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              )}
            </View>
          </>
        )}
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
  stageBlock: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stageBlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  addStageButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 8,
  },
  addStageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
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
