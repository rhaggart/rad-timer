import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_SESSIONS, TABLE_RESULTS } from '../utils/db';
import PDFDocument from 'pdfkit';

function formatMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildPdf(
  raceName: string,
  createdAt: string,
  results: Array<{
    participantName: string;
    elapsedTime: number;
    attemptNumber?: number;
    stageTimes?: number[];
  }>,
  stageCount: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text(raceName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toISOString().slice(0, 10)}`, { align: 'center' });
    if (createdAt) {
      doc.fontSize(9).text(`Race created: ${createdAt.slice(0, 10)}`, { align: 'center' });
    }
    doc.moveDown(1);

    const colWidths = [30, 120, 70];
    const stageColWidth = 55;
    if (stageCount > 0) {
      for (let i = 0; i < stageCount; i++) {
        colWidths.push(stageColWidth);
      }
    }
    const tableTop = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Rank', 50, tableTop, { width: colWidths[0] });
    doc.text('Name', 50 + colWidths[0], tableTop, { width: colWidths[1] });
    doc.text('Total', 50 + colWidths[0] + colWidths[1], tableTop, { width: colWidths[2] });
    let xStage = 50 + colWidths[0] + colWidths[1] + colWidths[2];
    for (let i = 0; i < stageCount; i++) {
      doc.text(`S${i + 1}`, xStage, tableTop, { width: stageColWidth });
      xStage += stageColWidth;
    }
    doc.moveDown(0.5);
    doc.font('Helvetica');

    results.forEach((r, idx) => {
      const y = doc.y;
      doc.text(String(idx + 1), 50, y, { width: colWidths[0] });
      doc.text(r.participantName + (r.attemptNumber && r.attemptNumber > 1 ? ` (#${r.attemptNumber})` : ''), 50 + colWidths[0], y, { width: colWidths[1] });
      doc.text(formatMs(r.elapsedTime), 50 + colWidths[0] + colWidths[1], y, { width: colWidths[2] });
      xStage = 50 + colWidths[0] + colWidths[1] + colWidths[2];
      if (r.stageTimes) {
        for (const t of r.stageTimes) {
          doc.text(formatMs(t), xStage, y, { width: stageColWidth });
          xStage += stageColWidth;
        }
      }
      doc.moveDown(0.4);
    });

    doc.end();
  });
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const raceId = event.pathParameters?.id;
    if (!raceId) {
      return { statusCode: 404, body: 'Race not found' };
    }

    const raceResult = await docClient.send(
      new GetCommand({ TableName: TABLE_SESSIONS, Key: { raceId } }),
    );
    if (!raceResult.Item) {
      return { statusCode: 404, body: 'Race not found' };
    }

    const race = raceResult.Item as { plan?: string; name?: string; createdAt?: string; stages?: unknown[] };
    if (race.plan !== 'paid') {
      return { statusCode: 403, body: 'PDF download is only available for paid races.' };
    }

    const resultsResponse = await docClient.send(
      new QueryCommand({
        TableName: TABLE_RESULTS,
        IndexName: 'raceId-elapsedTime-index',
        KeyConditionExpression: 'raceId = :rid',
        ExpressionAttributeValues: { ':rid': raceId },
        ScanIndexForward: true,
      }),
    );
    const results = (resultsResponse.Items ?? []).map((r) => ({
      participantName: (r as { participantName?: string }).participantName ?? '',
      elapsedTime: Number((r as { elapsedTime?: number }).elapsedTime ?? 0),
      attemptNumber: (r as { attemptNumber?: number }).attemptNumber,
      stageTimes: (r as { stageTimes?: number[] }).stageTimes,
    }));
    const stageCount = Array.isArray(race.stages) ? race.stages.length : 0;

    const pdfBuffer = await buildPdf(
      race.name ?? 'Race',
      race.createdAt ?? '',
      results,
      stageCount,
    );
    const base64 = pdfBuffer.toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="leaderboard.pdf"',
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('getLeaderboardPdf error:', err);
    return { statusCode: 500, body: 'Internal server error' };
  }
}
