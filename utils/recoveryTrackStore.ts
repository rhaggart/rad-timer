/**
 * Persisted recovery data for when the app is closed or the phone dies during
 * tracking or before upload. Lets the user return to the record screen and
 * complete upload (e.g. from the results/leaderboard page).
 */
import { storageGetItem, storageSetItem } from './storage';

const KEY_PREFIX = '@radtimer/recovery_track/';

export interface RecoveryTrack {
  raceId: string;
  participantName: string;
  raceName: string;
  isDirector?: boolean;
  points: Array<{ lat: number; lng: number; timestamp: number }>;
  timestampFallback?: boolean;
  savedAt: number;
}

export async function getRecoveryTrack(raceId: string): Promise<RecoveryTrack | null> {
  try {
    const raw = await storageGetItem(KEY_PREFIX + raceId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecoveryTrack;
    if (!parsed?.raceId || !Array.isArray(parsed.points) || parsed.points.length < 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setRecoveryTrack(
  raceId: string,
  data: Omit<RecoveryTrack, 'raceId' | 'savedAt'>
): Promise<void> {
  try {
    const entry: RecoveryTrack = {
      ...data,
      raceId,
      savedAt: Date.now(),
    };
    await storageSetItem(KEY_PREFIX + raceId, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export async function clearRecoveryTrack(raceId: string): Promise<void> {
  try {
    await storageSetItem(KEY_PREFIX + raceId, '');
  } catch {
    // ignore
  }
}

export async function hasRecoveryForRace(raceId: string): Promise<boolean> {
  const t = await getRecoveryTrack(raceId);
  return t != null;
}
