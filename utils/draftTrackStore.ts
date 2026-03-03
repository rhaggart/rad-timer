/**
 * In-memory store for a race director's draft track when they leave the record
 * screen (e.g. to see results) before uploading. Restored when they open record again.
 */
export interface DraftPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

const drafts: Record<string, { points: DraftPoint[] }> = {};

export function setDraftTrack(raceId: string, points: DraftPoint[]): void {
  if (points.length >= 2) {
    drafts[raceId] = { points };
  }
}

export function getDraftTrack(raceId: string): DraftPoint[] | null {
  const d = drafts[raceId];
  if (!d) return null;
  return d.points;
}

export function clearDraftTrack(raceId: string): void {
  delete drafts[raceId];
}
