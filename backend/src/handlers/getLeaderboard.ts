import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_SESSIONS, TABLE_RESULTS } from '../utils/db';
import { ok, notFound, serverError } from '../utils/response';

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const raceId = event.pathParameters?.id;
    if (!raceId) return notFound('Race not found');

    const raceResult = await docClient.send(
      new GetCommand({ TableName: TABLE_SESSIONS, Key: { raceId } }),
    );
    if (!raceResult.Item) return notFound('Race not found');

    const resultsResponse = await docClient.send(
      new QueryCommand({
        TableName: TABLE_RESULTS,
        IndexName: 'raceId-elapsedTime-index',
        KeyConditionExpression: 'raceId = :rid',
        ExpressionAttributeValues: { ':rid': raceId },
        ScanIndexForward: true,
      }),
    );

    return ok({
      race: raceResult.Item,
      results: resultsResponse.Items ?? [],
    });
  } catch (err) {
    console.error('getLeaderboard error:', err);
    return serverError();
  }
}
