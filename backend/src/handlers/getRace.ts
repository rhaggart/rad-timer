import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_SESSIONS } from '../utils/db';
import { ok, notFound, serverError } from '../utils/response';

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const raceId = event.pathParameters?.id;
    if (!raceId) return notFound('Race not found');

    const result = await docClient.send(
      new GetCommand({ TableName: TABLE_SESSIONS, Key: { raceId } }),
    );

    if (!result.Item) return notFound('Race not found');

    return ok(result.Item);
  } catch (err) {
    console.error('getRace error:', err);
    return serverError();
  }
}
