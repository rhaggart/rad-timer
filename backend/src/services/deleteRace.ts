import {
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { docClient, TABLE_SESSIONS, TABLE_RESULTS, TRACKS_BUCKET } from '../utils/db';

const s3 = new S3Client({});

const BATCH_SIZE = 25;

export async function deleteRaceById(raceId: string): Promise<void> {
  const resultsResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_RESULTS,
      KeyConditionExpression: 'raceId = :rid',
      ExpressionAttributeValues: { ':rid': raceId },
      ProjectionExpression: 'raceId, resultId',
    }),
  );

  const items = resultsResult.Items ?? [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_RESULTS]: chunk.map((item) => ({
            DeleteRequest: {
              Key: { raceId: item.raceId, resultId: item.resultId },
            },
          })),
        },
      }),
    );
  }

  let continuationToken: string | undefined;
  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: TRACKS_BUCKET,
        Prefix: `${raceId}/`,
        ContinuationToken: continuationToken,
      }),
    );
    const keys = (list.Contents ?? []).map((o) => ({ Key: o.Key! }));
    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: TRACKS_BUCKET,
          Delete: { Objects: keys },
        }),
      );
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_SESSIONS,
      Key: { raceId },
    }),
  );
}

export async function deleteExpiredRaces(): Promise<void> {
  const now = new Date().toISOString();
  const scan = await docClient.send(
    new ScanCommand({
      TableName: TABLE_SESSIONS,
      FilterExpression:
        'expiresAt <= :now AND (attribute_not_exists(#plan) OR #plan <> :paid)',
      ExpressionAttributeNames: { '#plan': 'plan' },
      ExpressionAttributeValues: { ':now': now, ':paid': 'paid' },
      ProjectionExpression: 'raceId',
    }),
  );

  const expired = scan.Items ?? [];
  for (const item of expired) {
    const raceId = item.raceId as string;
    try {
      await deleteRaceById(raceId);
    } catch (err) {
      console.error(`Failed to delete expired race ${raceId}:`, err);
    }
  }
}
