import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import { docClient, TABLE_SESSIONS, TABLE_RESULTS, TRACKS_BUCKET } from '../utils/db';
import { ok, badRequest, notFound, serverError } from '../utils/response';
import {
  detectCrossings,
  detectMultiStageCrossings,
  type StageInput,
} from '../services/crossingDetector';

const s3 = new S3Client({});

interface UploadBody {
  participantName: string;
  points: Array<{ lat: number; lng: number; timestamp: number }>;
  /** True if any point used device time fallback instead of GPS. */
  timestampFallback?: boolean;
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
      return badRequest('This race has closed. Your result was not uploaded.');
    const submissionsCloseAt = race.submissionsCloseAt ?? race.expiresAt;
    if (
      submissionsCloseAt &&
      new Date() > new Date(submissionsCloseAt as string)
    )
      return badRequest(
        'This race has closed. Your result was not uploaded.',
      );

    const raceStages = race.stages as Array<{ startLine: unknown; finishLine: unknown }> | undefined;
    const useMultiStage =
      Array.isArray(raceStages) &&
      raceStages.length > 0 &&
      raceStages.every(
        (s) =>
          s &&
          typeof s === 'object' &&
          s.startLine != null &&
          s.finishLine != null,
      );

    let elapsedTime: number;
    let stageTimes: number[] | undefined;
    let startTime: number;
    let finishTime: number;

    if (useMultiStage && raceStages) {
      const stageInputs: StageInput[] = raceStages.map((s) => ({
        start: { line: s.startLine as { lat1: number; lng1: number; lat2: number; lng2: number } },
        finish: { line: s.finishLine as { lat1: number; lng1: number; lat2: number; lng2: number } },
      }));
      try {
        const multi = detectMultiStageCrossings(body.points, stageInputs);
        elapsedTime = multi.elapsedTime;
        stageTimes = multi.stageTimes;
        startTime = multi.startTime;
        finishTime = multi.finishTime;
      } catch (err) {
        return badRequest(
          err instanceof Error ? err.message : 'Track processing failed',
        );
      }
    } else {
      const startInput =
        race.startLine != null
          ? { line: race.startLine }
          : { coords: race.startCoords };
      const finishInput =
        race.finishLine != null
          ? { line: race.finishLine }
          : { coords: race.finishCoords };
      try {
        const crossingResult = detectCrossings(
          body.points,
          startInput,
          finishInput,
        );
        elapsedTime = crossingResult.elapsedTime;
        startTime = crossingResult.startTime;
        finishTime = crossingResult.finishTime;
      } catch (err) {
        return badRequest(
          err instanceof Error ? err.message : 'Track processing failed',
        );
      }
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

    const trackKey = `${raceId}/${resultId}.json`;
    await s3.send(
      new PutObjectCommand({
        Bucket: TRACKS_BUCKET,
        Key: trackKey,
        Body: JSON.stringify(body.points),
        ContentType: 'application/json',
      }),
    );

    const resultItem: Record<string, unknown> = {
      raceId,
      resultId,
      participantName: body.participantName.trim(),
      elapsedTime,
      uploadedAt: new Date().toISOString(),
      attemptNumber,
      startTime,
      finishTime,
      timestampFallback: body.timestampFallback === true,
      gpsSampling: race.gpsSampling === 'high' ? 'high' : 'standard',
    };
    if (stageTimes != null) resultItem.stageTimes = stageTimes;

    await docClient.send(
      new PutCommand({ TableName: TABLE_RESULTS, Item: resultItem }),
    );

    await s3.send(
      new DeleteObjectCommand({
        Bucket: TRACKS_BUCKET,
        Key: trackKey,
      }),
    );

    return ok(resultItem);
  } catch (err) {
    console.error('uploadTrack error:', err);
    return serverError();
  }
}
