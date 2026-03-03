import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import {
  BACKGROUND_LOCATION_TASK,
  getBackgroundLocationPoints,
  clearBackgroundLocationPoints,
  getBackgroundLocationPointCount,
} from '../tasks/backgroundLocation';

const PERMISSION_MESSAGE =
  "Allow 'Always' location in Settings so your race can be recorded.";

const EXPO_GO_MESSAGE =
  "Background location isn't available in Expo Go. Test with a development or production build (e.g. TestFlight).";

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

type RecordingState = 'idle' | 'recording' | 'stopped';

export function useGPSRecording() {
  const [state, setState] = useState<RecordingState>('idle');
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTracking = useCallback(async () => {
    try {
      setError(null);
      setPoints([]);
      clearBackgroundLocationPoints();

      const { status: foreground } =
        await Location.requestForegroundPermissionsAsync();
      if (foreground !== 'granted') {
        setError(PERMISSION_MESSAGE);
        return;
      }

      const { status: background } =
        await Location.getBackgroundPermissionsAsync();
      if (background === 'granted') {
        await doStartLocationUpdates();
        return;
      }

      return new Promise<void>((resolve) => {
        Alert.alert(
          'Location access',
          "RAD Timer needs 'Always' location access so your race is recorded when the screen is off (e.g. phone in pocket). Tap OK to open Settings and set location to Always.",
          [
            { text: 'Cancel', onPress: () => resolve(), style: 'cancel' },
            {
              text: 'OK',
              onPress: () => {
                Linking.openSettings();
                resolve();
              },
            },
          ],
        );
      });
    } catch (err) {
      setError(PERMISSION_MESSAGE);
      setState('idle');
    }
  }, []);

  const doStartLocationUpdates = async () => {
    try {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 500,
        distanceInterval: 1,
        showsBackgroundLocationIndicator: true,
      });
      setState('recording');
      pollIntervalRef.current = setInterval(() => {
        const count = getBackgroundLocationPointCount();
        if (count > 0) {
          setPoints(getBackgroundLocationPoints());
        }
      }, 1500);
    } catch (e) {
      const msg =
        e instanceof Error && e.message?.includes('NSLocation')
          ? EXPO_GO_MESSAGE
          : PERMISSION_MESSAGE;
      setError(msg);
    }
  };

  const stopRecording = useCallback(async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK,
      );
      if (running) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch {
      // ignore
    }
    setPoints(getBackgroundLocationPoints());
    setState('stopped');
  }, []);

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    try {
      Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).then(
        (running) => {
          if (running) {
            Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          }
        },
      );
    } catch {
      // ignore
    }
    clearBackgroundLocationPoints();
    setPoints([]);
    setState('idle');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return {
    state,
    points,
    pointCount: points.length,
    error,
    startRecording: startTracking,
    stopRecording,
    reset,
  };
}
