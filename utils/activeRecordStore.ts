/**
 * When a racer or director has an active track (recording or stopped but not uploaded),
 * we store the race context here so a banner can be shown on other screens to return and finish.
 */
export interface ActiveRecord {
  raceId: string;
  participantName: string;
  raceName: string;
  isDirector?: boolean;
}

let current: ActiveRecord | null = null;
const listeners: Array<() => void> = [];

export function getActiveRecord(): ActiveRecord | null {
  return current;
}

export function setActiveRecord(record: ActiveRecord): void {
  current = record;
  listeners.forEach((cb) => cb());
}

export function clearActiveRecord(): void {
  current = null;
  listeners.forEach((cb) => cb());
}

export function subscribeActiveRecord(callback: () => void): () => void {
  listeners.push(callback);
  return () => {
    const i = listeners.indexOf(callback);
    if (i >= 0) listeners.splice(i, 1);
  };
}
