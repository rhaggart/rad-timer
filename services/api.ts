import Constants from 'expo-constants';

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://api.radtimer.com';

interface RaceSession {
  raceId: string;
  name: string;
  startCoords: { lat: number; lng: number };
  finishCoords: { lat: number; lng: number };
  createdAt: string;
  expiresAt: string;
  status: 'open' | 'closed';
}

interface CreateRaceParams {
  name: string;
  startCoords: { lat: number; lng: number };
  finishCoords: { lat: number; lng: number };
  expiryHours?: number;
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
}

interface LeaderboardResponse {
  race: RaceSession;
  results: LeaderboardEntry[];
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
    throw new Error(body || `Request failed: ${res.status}`);
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

  getRace(raceId: string): Promise<RaceSession> {
    return request(`/races/${raceId}`);
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
  CreateRaceParams,
  UploadTrackParams,
  UploadResult,
  LeaderboardEntry,
  LeaderboardResponse,
};
