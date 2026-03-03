import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_SESSIONS } from '../utils/db';
import { ok, serverError } from '../utils/response';
import { deleteExpiredRaces } from '../services/deleteRace';

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    await deleteExpiredRaces();

    const now = new Date().toISOString();
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_SESSIONS,
        FilterExpression:
          '#status = :open AND (expiresAt > :now OR #plan = :paid)',
        ExpressionAttributeNames: { '#status': 'status', '#plan': 'plan' },
        ExpressionAttributeValues: {
          ':open': 'open',
          ':now': now,
          ':paid': 'paid',
        },
      }),
    );

    const races = (result.Items ?? []).sort(
      (a, b) =>
        new Date(b.createdAt as string).getTime() -
        new Date(a.createdAt as string).getTime(),
    );

    return ok({ races });
  } catch (err) {
    console.error('listRaces error:', err);
    return serverError();
  }
}
