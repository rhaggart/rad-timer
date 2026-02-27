import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { docClient, TABLE_SESSIONS } from '../utils/db';
import { created, badRequest, serverError } from '../utils/response';

interface CreateRaceBody {
  name: string;
  startCoords: { lat: number; lng: number };
  finishCoords: { lat: number; lng: number };
  expiryHours?: number;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const body: CreateRaceBody = JSON.parse(event.body ?? '{}');

    if (!body.name?.trim()) return badRequest('Race name is required');
    if (!body.startCoords?.lat || !body.startCoords?.lng)
      return badRequest('Start coordinates are required');
    if (!body.finishCoords?.lat || !body.finishCoords?.lng)
      return badRequest('Finish coordinates are required');

    const raceId = uuid();
    const now = new Date();
    const expiryHours = body.expiryHours ?? 4;
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const item = {
      raceId,
      name: body.name.trim(),
      startCoords: body.startCoords,
      finishCoords: body.finishCoords,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'open' as const,
    };

    await docClient.send(
      new PutCommand({ TableName: TABLE_SESSIONS, Item: item }),
    );

    return created(item);
  } catch (err) {
    console.error('createRace error:', err);
    return serverError();
  }
}
