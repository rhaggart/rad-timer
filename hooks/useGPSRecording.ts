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

/** Merge and sort by timestamp; dedupe by timestamp (keep first). */
function mergePoints(background: GPSPoint[], foreground: GPSPoint[]): GPSPoint[] {
  const byTime = new Map<number, GPSPoint>();
  [...background, ...foreground].forEach((p) => {
    if (!byTime.has(p.timestamp)) byTime.set(p.timestamp, p);
  });
  return Array.from(byTime.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function useGPSRecording() {
  const [state, setState] = useState<RecordingState>('idle');
  const [points, setPoints] = useState<GPSPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foregroundSubRef = useRef<Location.LocationSubscription | null>(null);
  const foregroundPointsRef = useRef<GPSPoint[]>([]);

  const startTracking = useCallback(async (highAccuracy = false) => {
    try {
      setError(null);
      setPoints([]);
      clearBackgroundLocationPoints();
      foregroundPointsRef.current = [];

      const { status: foreground } =
        await Location.requestForegroundPermissionsAsync();
      if (foreground !== 'granted') {
        setError(PERMISSION_MESSAGE);
        return;
      }

      const { status: background } =
        await Location.getBackgroundPermissionsAsync();
      if (background === 'granted') {
        await doStartLocationUpdates(highAccuracy);
        return;
      }

      // Background not granted: still record using foreground-only so track is visible when app is open
      await startForegroundOnly(highAccuracy);
    } catch (err) {
      setError(PERMISSION_MESSAGE);
      setState('idle');
    }
  }, []);

  const startForegroundOnly = async (highAccuracy: boolean) => {
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: highAccuracy ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
          timeInterval: highAccuracy ? 500 : 1000,
          distanceInterval: 0,
        },
        (loc) => {
          const p: GPSPoint = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            timestamp: loc.timestamp ?? Date.now(),
          };
          foregroundPointsRef.current.push(p);
          setPoints((prev) => [...prev, p]);
        },
      );
      foregroundSubRef.current = sub;
      setState('recording');
    } catch (e) {
      const msg =
        e instanceof Error && e.message?.includes('NSLocation')
          ? EXPO_GO_MESSAGE
          : PERMISSION_MESSAGE;
      setError(msg);
    }
  };

  const doStartLocationUpdates = async (highAccuracy = false) => {
    try {
      if (highAccuracy) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 250,
          distanceInterval: 0.5,
          showsBackgroundLocationIndicator: true,
        });
      } else {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
          showsBackgroundLocationIndicator: true,
        });
      }
      setState('recording');
      // Foreground fallback: also watch so we always have points when app is open (fixes empty track on stop)
      const sub = await Location.watchPositionAsync(
        {
          accuracy: highAccuracy ? Location.Accuracy.BestForNavigation : Location.Accuracy.Balanced,
          timeInterval: highAccuracy ? 500 : 1000,
          distanceInterval: 0,
        },
        (loc) => {
          const p: GPSPoint = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            timestamp: loc.timestamp ?? Date.now(),
          };
          foregroundPointsRef.current.push(p);
        },
      );
      foregroundSubRef.current = sub;
      pollIntervalRef.current = setInterval(() => {
        const bg = getBackgroundLocationPoints();
        const fg = foregroundPointsRef.current;
        const merged = mergePoints(bg, fg);
        if (merged.length > 0) {
          setPoints(merged);
        }
      }, 1000);
    } catch (e) {
      const msg =
        e instanceof Error && e.message?.includes('NSLocation')
          ? EXPO_GO_MESSAGE
          : PERMISSION_MESSAGE;
      setError(msg);
    }
  };

  const stopRecording = useCallback(async () => {
    if (foregroundSubRef.current) {
      foregroundSubRef.current.remove();
      foregroundSubRef.current = null;
    }
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
    // Give the background task time to flush final locations (critical when phone was locked during race)
    await new Promise((r) => setTimeout(r, 800));
    // Poll a few times and take the fullest set in case the task delivers batches asynchronously
    let bg = getBackgroundLocationPoints();
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const next = getBackgroundLocationPoints();
      if (next.length > bg.length) bg = next;
    }
    const fg = foregroundPointsRef.current;
    const merged = mergePoints(bg, fg);
    setPoints(merged);
    foregroundPointsRef.current = [];
    setState('stopped');
  }, []);

  const reset = useCallback(() => {
    if (foregroundSubRef.current) {
      foregroundSubRef.current.remove();
      foregroundSubRef.current = null;
    }
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
    foregroundPointsRef.current = [];
    setPoints([]);
    setState('idle');
    setError(null);
  }, []);

  /** Restore a draft track (e.g. after director navigated away). Puts hook in 'stopped' with these points. */
  const loadDraft = useCallback((draftPoints: Array<{ lat: number; lng: number; timestamp: number }>) => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPoints(draftPoints.length >= 2 ? draftPoints : []);
    setState(draftPoints.length >= 2 ? 'stopped' : 'idle');
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
    loadDraft,
  };
}
