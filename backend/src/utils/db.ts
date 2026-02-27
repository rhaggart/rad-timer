import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_SESSIONS = process.env.TABLE_SESSIONS!;
export const TABLE_RESULTS = process.env.TABLE_RESULTS!;
export const TRACKS_BUCKET = process.env.TRACKS_BUCKET!;
