import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import type { LineSegment } from '../services/api';

const WIDTH = 280;
const HEIGHT = 160;
const PAD = 12;

interface Point {
  lat: number;
  lng: number;
}

interface TrackPreviewProps {
  /** GPS points (may include timestamp or latitude/longitude); invalid points are filtered out. */
  points: Array<{ lat?: number; lng?: number; latitude?: number; longitude?: number; timestamp?: number }>;
  startLine?: LineSegment | null;
  finishLine?: LineSegment | null;
}

function toPoint(p: { lat?: number; lng?: number; latitude?: number; longitude?: number }): Point | null {
  const lat = Number(p?.lat ?? p?.latitude);
  const lng = Number(p?.lng ?? p?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
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
  singlePointCoord: { x: number; y: number } | null;
} {
  if (points.length === 0) {
    return { pathD: '', lineCoords: [], singlePointCoord: null };
  }
  const all: Point[] = [...points];
  lines.forEach(([a, b]) => {
    all.push(a, b);
  });
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  if (!Number.isFinite(minLat) || !Number.isFinite(maxLng)) {
    return { pathD: '', lineCoords: [], singlePointCoord: null };
  }
  const rangeLat = Math.max(maxLat - minLat, 5e-5);
  const rangeLng = Math.max(maxLng - minLng, 5e-5);
  const padLat = (rangeLat - (maxLat - minLat)) / 2;
  const padLng = (rangeLng - (maxLng - minLng)) / 2;
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const scale = Math.min(innerW / rangeLng, innerH / rangeLat);
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  const toX = (lng: number) => pad + (lng - minLng) * safeScale;
  const toY = (lat: number) => height - pad - (lat - minLat) * safeScale;

  const pathD =
    points.length >= 2
      ? points
          .map((p, i) => {
            const x = toX(p.lng);
            const y = toY(p.lat);
            return Number.isFinite(x) && Number.isFinite(y) ? `${i === 0 ? 'M' : 'L'} ${x} ${y}` : null;
          })
          .filter(Boolean)
          .join(' ')
      : '';

  const lineCoords = lines.map(([a, b]) => ({
    x1: toX(a.lng),
    y1: toY(a.lat),
    x2: toX(b.lng),
    y2: toY(b.lat),
  }));

  const singlePointCoord =
    points.length === 1
      ? (() => {
          const x = toX(points[0].lng);
          const y = toY(points[0].lat);
          return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
        })()
      : null;

  return {
    pathD,
    lineCoords,
    singlePointCoord,
  };
}

export function TrackPreview({
  points,
  startLine,
  finishLine,
}: TrackPreviewProps) {
  const { pathD, lineCoords, singlePointCoord, validPoints } = useMemo(() => {
    const valid = Array.isArray(points)
      ? points.map(toPoint).filter((p): p is Point => p != null)
      : [];
    const lines: Array<[Point, Point]> = [];
    if (startLine) {
      const a = toPoint({ lat: startLine.lat1, lng: startLine.lng1 });
      const b = toPoint({ lat: startLine.lat2, lng: startLine.lng2 });
      if (a && b) lines.push([a, b]);
    }
    if (finishLine) {
      const a = toPoint({ lat: finishLine.lat1, lng: finishLine.lng1 });
      const b = toPoint({ lat: finishLine.lat2, lng: finishLine.lng2 });
      if (a && b) lines.push([a, b]);
    }
    const proj = project(valid, lines, WIDTH, HEIGHT, PAD);
    return { ...proj, validPoints: valid };
  }, [points, startLine, finishLine]);

  const startCoord = startLine && lineCoords.length > 0 ? lineCoords[0] : null;
  const finishCoord = finishLine
    ? lineCoords[startLine ? 1 : 0]
    : null;

  const hasTrack = pathD.length > 0 || singlePointCoord != null;
  if (!hasTrack && validPoints.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={styles.svg}>
        {pathD ? (
          <Path
            d={pathD}
            fill="none"
            stroke="#6366f1"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : singlePointCoord ? (
          <Circle cx={singlePointCoord.x} cy={singlePointCoord.y} r={6} fill="#6366f1" />
        ) : null}
        {startCoord && (
          <Line
            x1={startCoord.x1}
            y1={startCoord.y1}
            x2={startCoord.x2}
            y2={startCoord.y2}
            stroke="#4CAF50"
            strokeWidth={3}
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
            strokeWidth={3}
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
    minHeight: HEIGHT + 32,
  },
  svg: {
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
