import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import { docClient, TABLE_SESSIONS, TABLE_RESULTS, TRACKS_BUCKET } from '../utils/db';
import { ok, badRequest, notFound, serverError } from '../utils/response';
import {
  detectMultipleLaps,
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

    // Normalize timestamps to milliseconds (Expo sends ms; some clients may send seconds)
    const points = body.points.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp >= 1e12 ? p.timestamp : Math.round(p.timestamp * 1000),
    }));

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

    const participantName = body.participantName.trim();
    const uploadedAt = new Date().toISOString();

    if (useMultiStage && raceStages) {
      const stageInputs: StageInput[] = raceStages.map((s) => ({
        start: { line: s.startLine as { lat1: number; lng1: number; lat2: number; lng2: number } },
        finish: { line: s.finishLine as { lat1: number; lng1: number; lat2: number; lng2: number } },
      }));
      let elapsedTime: number;
      let stageTimes: number[];
      let startTime: number;
      let finishTime: number;
      try {
        const multi = detectMultiStageCrossings(points, stageInputs);
        elapsedTime = multi.elapsedTime;
        stageTimes = multi.stageTimes;
        startTime = multi.startTime;
        finishTime = multi.finishTime;
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
            ':pname': participantName,
          },
        }),
      );
      const maxAttempt = (existingAttempts.Items ?? []).reduce(
        (m, item) => Math.max(m, (item.attemptNumber as number) ?? 0),
        0,
      );
      const attemptNumber = maxAttempt + 1;

      const resultId = uuid();
      const trackKey = `${raceId}/${resultId}.json`;
      await s3.send(
        new PutObjectCommand({
          Bucket: TRACKS_BUCKET,
          Key: trackKey,
          Body: JSON.stringify(points),
          ContentType: 'application/json',
        }),
      );

      const resultItem: Record<string, unknown> = {
        raceId,
        resultId,
        participantName,
        elapsedTime,
        uploadedAt,
        attemptNumber,
        startTime,
        finishTime,
        timestampFallback: body.timestampFallback === true,
        gpsSampling: race.gpsSampling === 'high' ? 'high' : 'standard',
        stageTimes,
      };

      await docClient.send(
        new PutCommand({ TableName: TABLE_RESULTS, Item: resultItem }),
      );
      await s3.send(
        new DeleteObjectCommand({ Bucket: TRACKS_BUCKET, Key: trackKey }),
      );
      return ok(resultItem);
    }

    // Single-stage: detect all laps (start→finish, start→finish, ...)
    const startInput =
      race.startLine != null
        ? { line: race.startLine }
        : { coords: race.startCoords };
    const finishInput =
      race.finishLine != null
        ? { line: race.finishLine }
        : { coords: race.finishCoords };

    let laps: Array<{ startTime: number; finishTime: number; elapsedTime: number }>;
    try {
      laps = detectMultipleLaps(points, startInput, finishInput);
    } catch (err) {
      return badRequest(
        err instanceof Error ? err.message : 'Track processing failed',
      );
    }

    console.log('uploadTrack laps', {
      raceId,
      pointCount: points.length,
      lapCount: laps.length,
      laps: laps.map((l) => l.elapsedTime),
    });

    const existingAttempts = await docClient.send(
      new QueryCommand({
        TableName: TABLE_RESULTS,
        KeyConditionExpression: 'raceId = :rid',
        FilterExpression: 'participantName = :pname',
        ExpressionAttributeValues: {
          ':rid': raceId,
          ':pname': participantName,
        },
      }),
    );
    const maxAttempt = (existingAttempts.Items ?? []).reduce(
      (m, item) => Math.max(m, (item.attemptNumber as number) ?? 0),
      0,
    );
    const attemptNumber = maxAttempt + 1;

    const trackKey = `${raceId}/${uuid()}.json`;
    await s3.send(
      new PutObjectCommand({
        Bucket: TRACKS_BUCKET,
        Key: trackKey,
        Body: JSON.stringify(points),
        ContentType: 'application/json',
      }),
    );

    const created: Record<string, unknown>[] = [];
    for (let lapNumber = 1; lapNumber <= laps.length; lapNumber++) {
      const lap = laps[lapNumber - 1];
      const resultId = uuid();
      const resultItem: Record<string, unknown> = {
        raceId,
        resultId,
        participantName,
        elapsedTime: lap.elapsedTime,
        uploadedAt,
        attemptNumber,
        lapNumber,
        startTime: lap.startTime,
        finishTime: lap.finishTime,
        timestampFallback: body.timestampFallback === true,
        gpsSampling: race.gpsSampling === 'high' ? 'high' : 'standard',
      };
      await docClient.send(
        new PutCommand({ TableName: TABLE_RESULTS, Item: resultItem }),
      );
      created.push(resultItem);
    }

    await s3.send(
      new DeleteObjectCommand({ Bucket: TRACKS_BUCKET, Key: trackKey }),
    );

    return ok(
      laps.length === 1 ? created[0] : { laps: created, count: laps.length },
    );
  } catch (err) {
    console.error('uploadTrack error:', err);
    return serverError();
  }
}
