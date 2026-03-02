import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { docClient, TABLE_SESSIONS } from '../utils/db';
import { created, badRequest, serverError } from '../utils/response';

interface LineSegmentBody {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}

interface CreateRaceBody {
  name: string;
  startCoords?: { lat: number; lng: number };
  finishCoords?: { lat: number; lng: number };
  startLine?: LineSegmentBody;
  finishLine?: LineSegmentBody;
  /** How long until submissions close (hours). Race is always deleted 24h after creation. */
  durationHours?: number;
  expiryHours?: number;
}

function isLineSegment(x: unknown): x is LineSegmentBody {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.lat1 === 'number' &&
    typeof o.lng1 === 'number' &&
    typeof o.lat2 === 'number' &&
    typeof o.lng2 === 'number'
  );
}

function lineMidpoint(line: LineSegmentBody): { lat: number; lng: number } {
  return {
    lat: (line.lat1 + line.lat2) / 2,
    lng: (line.lng1 + line.lng2) / 2,
  };
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const body: CreateRaceBody = JSON.parse(event.body ?? '{}');

    if (!body.name?.trim()) return badRequest('Race name is required');

    let startCoords: { lat: number; lng: number };
    let finishCoords: { lat: number; lng: number };
    let startLine: LineSegmentBody | undefined;
    let finishLine: LineSegmentBody | undefined;

    if (isLineSegment(body.startLine) && isLineSegment(body.finishLine)) {
      startLine = body.startLine;
      finishLine = body.finishLine;
      startCoords = lineMidpoint(startLine);
      finishCoords = lineMidpoint(finishLine);
    } else if (
      body.startCoords?.lat != null &&
      body.startCoords?.lng != null &&
      body.finishCoords?.lat != null &&
      body.finishCoords?.lng != null
    ) {
      startCoords = body.startCoords;
      finishCoords = body.finishCoords;
    } else {
      return badRequest(
        'Either startLine and finishLine (each with lat1, lng1, lat2, lng2) or startCoords and finishCoords are required',
      );
    }

    const raceId = uuid();
    const now = new Date();
    const durationHours = body.durationHours ?? body.expiryHours ?? 24;
    const submissionsCloseAt = new Date(
      now.getTime() + durationHours * 60 * 60 * 1000,
    );
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const item: Record<string, unknown> = {
      raceId,
      name: body.name.trim(),
      startCoords,
      finishCoords,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      submissionsCloseAt: submissionsCloseAt.toISOString(),
      status: 'open' as const,
    };
    if (startLine) item.startLine = startLine;
    if (finishLine) item.finishLine = finishLine;

    await docClient.send(
      new PutCommand({ TableName: TABLE_SESSIONS, Item: item }),
    );

    return created(item);
  } catch (err) {
    console.error('createRace error:', err);
    return serverError();
  }
}
