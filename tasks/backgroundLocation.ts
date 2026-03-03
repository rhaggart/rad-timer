/**
 * Background location task for race tracking. Must be imported at app load (e.g. from _layout)
 * so TaskManager.defineTask is registered before startLocationUpdatesAsync is used.
 */
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const BACKGROUND_LOCATION_TASK = 'rad-timer-background-location';

export interface StoredGPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
  /** True when timestamp came from Date.now() fallback instead of GPS. */
  timestampFallback?: boolean;
}

const points: StoredGPSPoint[] = [];

export function getBackgroundLocationPoints(): StoredGPSPoint[] {
  return [...points];
}

export function clearBackgroundLocationPoints(): void {
  points.length = 0;
}

export function getBackgroundLocationPointCount(): number {
  return points.length;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({
  data,
  error,
}: {
  data: { locations: Location.LocationObject[] };
  error: Error | null;
}) => {
  if (error) {
    console.error('Background location task error:', error.message);
    return;
  }
  if (data?.locations?.length) {
    for (const loc of data.locations) {
      const usedFallback = loc.timestamp == null;
      points.push({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        timestamp: loc.timestamp ?? Date.now(),
        ...(usedFallback && { timestampFallback: true }),
      });
    }
  }
});
