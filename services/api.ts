import Constants from 'expo-constants';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://api.radtimer.com';

/** Line segment for start/finish gate (two endpoints). */
export interface LineSegment {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}

/** One stage in a multi-stage race: own start and finish line. */
export interface StageSegment {
  startLine: LineSegment;
  finishLine: LineSegment;
}

interface RaceSession {
  raceId: string;
  name: string;
  startCoords: { lat: number; lng: number };
  finishCoords: { lat: number; lng: number };
  startLine?: LineSegment;
  finishLine?: LineSegment;
  createdAt: string;
  expiresAt: string;
  status: 'open' | 'closed';
  plan?: 'free' | 'paid';
  stages?: StageSegment[];
}

interface CreateRaceParams {
  name: string;
  /** Single-stage: provide startLine + finishLine. Multi-stage: provide stages (requires plan: 'paid'). */
  startLine?: LineSegment;
  finishLine?: LineSegment;
  startCoords?: { lat: number; lng: number };
  finishCoords?: { lat: number; lng: number };
  durationHours?: number;
  plan?: 'free' | 'paid';
  stages?: StageSegment[];
}

interface UploadTrackParams {
  participantName: string;
  points: Array<{ lat: number; lng: number; timestamp: number }>;
}

interface UploadResult {
  resultId: string;
  elapsedTime: number;
  attemptNumber: number;
}

interface LeaderboardEntry {
  resultId: string;
  participantName: string;
  elapsedTime: number;
  uploadedAt: string;
  attemptNumber: number;
  stageTimes?: number[];
}

interface LeaderboardResponse {
  race: RaceSession;
  results: LeaderboardEntry[];
}

interface ListRacesResponse {
  races: RaceSession[];
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message = body || `Request failed: ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      // use body as message
    }
    throw new Error(message);
  }

  return res.json();
}

export const api = {
  createRace(params: CreateRaceParams): Promise<RaceSession> {
    return request('/races', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  listRaces(): Promise<ListRacesResponse> {
    return request('/races');
  },

  getRace(raceId: string): Promise<RaceSession> {
    return request(`/races/${raceId}`);
  },

  deleteRace(raceId: string): Promise<{ deleted: string }> {
    return request(`/races/${raceId}`, { method: 'DELETE' });
  },

  uploadTrack(
    raceId: string,
    params: UploadTrackParams,
  ): Promise<UploadResult> {
    return request(`/races/${raceId}/upload`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getLeaderboard(raceId: string): Promise<LeaderboardResponse> {
    return request(`/races/${raceId}/leaderboard`);
  },
};

export type {
  RaceSession,
  StageSegment,
  CreateRaceParams,
  UploadTrackParams,
  UploadResult,
  LeaderboardEntry,
  LeaderboardResponse,
  ListRacesResponse,
};
