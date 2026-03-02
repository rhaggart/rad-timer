import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_SESSIONS } from '../utils/db';
import { ok, notFound, serverError } from '../utils/response';
import { deleteRaceById } from '../services/deleteRace';

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const raceId = event.pathParameters?.id;
    if (!raceId) return notFound('Race not found');

    const existing = await docClient.send(
      new GetCommand({ TableName: TABLE_SESSIONS, Key: { raceId } }),
    );
    if (!existing.Item) return notFound('Race not found');

    await deleteRaceById(raceId);
    return ok({ deleted: raceId });
  } catch (err) {
    console.error('deleteRace error:', err);
    return serverError();
  }
}
