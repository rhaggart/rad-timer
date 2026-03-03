import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import type { LineSegment } from '../services/api';

const WIDTH = 280;
const HEIGHT = 160;
const PAD = 12;

interface Point {
  lat: number;
  lng: number;
}

interface TrackPreviewProps {
  points: Point[];
  startLine?: LineSegment | null;
  finishLine?: LineSegment | null;
}

function project(
  points: Point[],
  lines: Array<[Point, Point]>,
  width: number,
  height: number,
  pad: number
): {
  pathD: string;
  lineCoords: Array<{ x1: number; y1: number; x2: number; y2: number }>;
} {
  const all: Point[] = [...points];
  lines.forEach(([a, b]) => {
    all.push(a, b);
  });
  if (all.length === 0) {
    return { path: '', lineCoords: [] };
  }
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const rangeLat = maxLat - minLat || 1e-6;
  const rangeLng = maxLng - minLng || 1e-6;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const scale = Math.min(innerW / rangeLng, innerH / rangeLat);

  const toX = (lng: number) => pad + (lng - minLng) * scale;
  const toY = (lat: number) => height - pad - (lat - minLat) * scale;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.lng)} ${toY(p.lat)}`)
    .join(' ');

  const lineCoords = lines.map(([a, b]) => ({
    x1: toX(a.lng),
    y1: toY(a.lat),
    x2: toX(b.lng),
    y2: toY(b.lat),
  }));

  return { pathD, lineCoords };
}

export function TrackPreview({
  points,
  startLine,
  finishLine,
}: TrackPreviewProps) {
  const { pathD, lineCoords } = useMemo(() => {
    const lines: Array<[Point, Point]> = [];
    if (startLine) {
      lines.push(
        [
          { lat: startLine.lat1, lng: startLine.lng1 },
          { lat: startLine.lat2, lng: startLine.lng2 },
        ],
      );
    }
    if (finishLine) {
      lines.push(
        [
          { lat: finishLine.lat1, lng: finishLine.lng1 },
          { lat: finishLine.lat2, lng: finishLine.lng2 },
        ],
      );
    }
    return project(points, lines, WIDTH, HEIGHT, PAD);
  }, [points, startLine, finishLine]);

  if (points.length < 2) return null;

  const startCoord = startLine ? lineCoords[0] : null;
  const finishCoord = finishLine
    ? lineCoords[startLine ? 1 : 0]
    : null;

  return (
    <View style={styles.wrapper}>
      <Svg width={WIDTH} height={HEIGHT} style={styles.svg}>
        {pathD ? (
          <Path
            d={pathD}
            fill="none"
            stroke="#6366f1"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {startCoord && (
          <Line
            x1={startCoord.x1}
            y1={startCoord.y1}
            x2={startCoord.x2}
            y2={startCoord.y2}
            stroke="#4CAF50"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {finishCoord && (
          <Line
            x1={finishCoord.x1}
            y1={finishCoord.y1}
            x2={finishCoord.x2}
            y2={finishCoord.y2}
            stroke="#FF5252"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  svg: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
