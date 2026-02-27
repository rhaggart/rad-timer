import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import { docClient, TABLE_SESSIONS, TABLE_RESULTS, TRACKS_BUCKET } from '../utils/db';
import { ok, badRequest, notFound, serverError } from '../utils/response';
import { detectCrossings } from '../services/crossingDetector';

const s3 = new S3Client({});

interface UploadBody {
  participantName: string;
  points: Array<{ lat: number; lng: number; timestamp: number }>;
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const raceId = event.pathParameters?.id;
    if (!raceId) return notFound('Race not found');

    const body: UploadBody = JSON.parse(event.body ?? '{}');

    if (!body.participantName?.trim())
      return badRequest('Participant name is required');
    if (!Array.isArray(body.points) || body.points.length < 2)
      return badRequest('Track must contain at least 2 GPS points');

    const raceResult = await docClient.send(
      new GetCommand({ TableName: TABLE_SESSIONS, Key: { raceId } }),
    );
    if (!raceResult.Item) return notFound('Race not found');

    const race = raceResult.Item;
    if (race.status === 'closed')
      return badRequest('This race is closed');

    let crossingResult;
    try {
      crossingResult = detectCrossings(
        body.points,
        race.startCoords,
        race.finishCoords,
      );
    } catch (err) {
      return badRequest(
        err instanceof Error ? err.message : 'Track processing failed',
      );
    }

    const existingAttempts = await docClient.send(
      new QueryCommand({
        TableName: TABLE_RESULTS,
        KeyConditionExpression: 'raceId = :rid',
        FilterExpression: 'participantName = :pname',
        ExpressionAttributeValues: {
          ':rid': raceId,
          ':pname': body.participantName.trim(),
        },
      }),
    );
    const attemptNumber = (existingAttempts.Count ?? 0) + 1;

    const resultId = uuid();

    await s3.send(
      new PutObjectCommand({
        Bucket: TRACKS_BUCKET,
        Key: `${raceId}/${resultId}.json`,
        Body: JSON.stringify(body.points),
        ContentType: 'application/json',
      }),
    );

    const resultItem = {
      raceId,
      resultId,
      participantName: body.participantName.trim(),
      elapsedTime: crossingResult.elapsedTime,
      uploadedAt: new Date().toISOString(),
      attemptNumber,
    };

    await docClient.send(
      new PutCommand({ TableName: TABLE_RESULTS, Item: resultItem }),
    );

    return ok(resultItem);
  } catch (err) {
    console.error('uploadTrack error:', err);
    return serverError();
  }
}
