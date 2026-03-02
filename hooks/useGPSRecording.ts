import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';

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
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setPoints([]);

      const { status: foreground } =
        await Location.requestForegroundPermissionsAsync();
      if (foreground !== 'granted') {
        setError(PERMISSION_MESSAGE);
        return;
      }

      return new Promise<void>((resolve) => {
        Alert.alert(
          'Location access',
          "RAD Timer needs 'Always' location access so your race is recorded when the screen is off. This is the only option that will work for the race.",
          [
            { text: 'Cancel', onPress: () => resolve(), style: 'cancel' },
            {
              text: 'OK',
              onPress: async () => {
                try {
                  const { status: background } =
                    await Location.requestBackgroundPermissionsAsync();
                  if (background !== 'granted') {
                    setError(PERMISSION_MESSAGE);
                    resolve();
                    return;
                  }
                  setState('recording');
                  const sub = await Location.watchPositionAsync(
                    {
                      accuracy: Location.Accuracy.BestForNavigation,
                      timeInterval: 500,
                      distanceInterval: 1,
                    },
                    (location) => {
                      setPoints((prev) => [
                        ...prev,
                        {
                          lat: location.coords.latitude,
                          lng: location.coords.longitude,
                          timestamp: location.timestamp,
                        },
                      ]);
                    },
                  );
                  subscriptionRef.current = sub;
                } catch (e) {
                  const msg =
                    e instanceof Error && e.message?.includes('NSLocation')
                      ? EXPO_GO_MESSAGE
                      : PERMISSION_MESSAGE;
                  setError(msg);
                }
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

  const stopRecording = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setState('stopped');
  }, []);

  const reset = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setPoints([]);
    setState('idle');
    setError(null);
  }, []);

  return {
    state,
    points,
    pointCount: points.length,
    error,
    startRecording,
    stopRecording,
    reset,
  };
}
