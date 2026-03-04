import { storageGetItem, storageSetItem } from './storage';

const KEY_CREATED = '@radtimer/created_race_ids';
const KEY_JOINED = '@radtimer/joined_race_ids';

export async function getCreatedRaceIds(): Promise<string[]> {
  try {
    const raw = await storageGetItem(KEY_CREATED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getJoinedRaceIds(): Promise<string[]> {
  try {
    const raw = await storageGetItem(KEY_JOINED);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addCreatedRaceId(raceId: string): Promise<void> {
  const ids = await getCreatedRaceIds();
  if (ids.includes(raceId)) return;
  await storageSetItem(KEY_CREATED, JSON.stringify([...ids, raceId]));
}

export async function addJoinedRaceId(raceId: string): Promise<void> {
  const ids = await getJoinedRaceIds();
  if (ids.includes(raceId)) return;
  await storageSetItem(KEY_JOINED, JSON.stringify([...ids, raceId]));
}

/** Returns raceIds that the user created or joined (for filtering active races list). */
export async function getMyRaceIds(): Promise<{ created: string[]; joined: string[] }> {
  const [created, joined] = await Promise.all([getCreatedRaceIds(), getJoinedRaceIds()]);
  return { created, joined };
}

export function isDirector(raceId: string, created: string[]): boolean {
  return created.includes(raceId);
}

export function isRacerOnly(raceId: string, created: string[], joined: string[]): boolean {
  return joined.includes(raceId) && !created.includes(raceId);
}

const KEY_LAST_PARTICIPANT_PREFIX = '@radtimer/last_participant/';

/** Get last used participant name for a race (for locking name when racing again from results). */
export async function getLastParticipantName(raceId: string): Promise<string> {
  try {
    const raw = await storageGetItem(KEY_LAST_PARTICIPANT_PREFIX + raceId);
    return raw?.trim() ?? '';
  } catch {
    return '';
  }
}

/** Save participant name when viewing results so "Race Again" can lock the name. */
export async function setLastParticipantName(raceId: string, name: string): Promise<void> {
  if (!name?.trim()) return;
  try {
    await storageSetItem(KEY_LAST_PARTICIPANT_PREFIX + raceId, name.trim());
  } catch {
    // ignore
  }
}
