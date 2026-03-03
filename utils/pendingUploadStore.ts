import { storageGetItem, storageSetItem } from './storage';

const KEY = '@radtimer/pending_uploads';

export interface PendingUpload {
  id: string;
  raceId: string;
  participantName: string;
  points: Array<{ lat: number; lng: number; timestamp: number }>;
  timestampFallback?: boolean;
  addedAt: number;
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  try {
    const raw = await storageGetItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addPendingUpload(
  raceId: string,
  participantName: string,
  points: Array<{ lat: number; lng: number; timestamp: number }>,
  timestampFallback?: boolean,
): Promise<PendingUpload> {
  const pending = await getPendingUploads();
  const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry: PendingUpload = {
    id,
    raceId,
    participantName,
    points,
    timestampFallback,
    addedAt: Date.now(),
  };
  pending.push(entry);
  await storageSetItem(KEY, JSON.stringify(pending));
  return entry;
}

export async function removePendingUpload(id: string): Promise<void> {
  const pending = await getPendingUploads();
  const next = pending.filter((p) => p.id !== id);
  await storageSetItem(KEY, JSON.stringify(next));
}

export function getPendingForRace(raceId: string, pending: PendingUpload[]): PendingUpload[] {
  return pending.filter((p) => p.raceId === raceId);
}
