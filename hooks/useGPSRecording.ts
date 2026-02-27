import { useState, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

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
        setError('Location permission is required to record your race.');
        return;
      }

      const { status: background } =
        await Location.requestBackgroundPermissionsAsync();
      if (background !== 'granted') {
        setError(
          'Background location permission is needed so tracking works while your screen is off.',
        );
        return;
      }

      setState('recording');

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
        },
        (location) => {
          const point: GPSPoint = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            timestamp: location.timestamp,
          };
          setPoints((prev) => [...prev, point]);
        },
      );

      subscriptionRef.current = sub;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to start GPS recording',
      );
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
