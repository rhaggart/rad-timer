import * as turf from '@turf/turf';

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

interface Coords {
  lat: number;
  lng: number;
}

/** Line segment as two points (lat/lng). */
export interface LineSegment {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}

interface CrossingResult {
  startTime: number;
  finishTime: number;
  elapsedTime: number;
}

const CORRIDOR_METERS = 15;

type LineStringFeature = ReturnType<typeof turf.lineString>;

/**
 * Build a short perpendicular line segment centered on a point.
 * Used when only startCoords/finishCoords (single point) is provided.
 */
function buildGateLine(center: Coords): LineStringFeature {
  const point = turf.point([center.lng, center.lat]);
  const left = turf.destination(point, CORRIDOR_METERS / 1000, 270, {
    units: 'kilometers',
  });
  const right = turf.destination(point, CORRIDOR_METERS / 1000, 90, {
    units: 'kilometers',
  });
  return turf.lineString([
    left.geometry.coordinates,
    right.geometry.coordinates,
  ]);
}

/**
 * Build a line from an explicit segment (two endpoints).
 */
function segmentToLine(seg: LineSegment): LineStringFeature {
  return turf.lineString([
    [seg.lng1, seg.lat1],
    [seg.lng2, seg.lat2],
  ]);
}

/**
 * Find the interpolated timestamp when the track crosses a gate line.
 */
function findCrossingTime(
  points: GPSPoint[],
  gateLine: LineStringFeature,
  startIndex = 0,
): { timestamp: number; index: number } | null {
  for (let i = startIndex; i < points.length - 1; i++) {
    const segmentLine = turf.lineString([
      [points[i].lng, points[i].lat],
      [points[i + 1].lng, points[i + 1].lat],
    ]);

    const intersection = turf.lineIntersect(segmentLine, gateLine);
    if (intersection.features.length > 0) {
      const crossPoint = intersection.features[0].geometry.coordinates;

      const dTotal = turf.distance(
        turf.point([points[i].lng, points[i].lat]),
        turf.point([points[i + 1].lng, points[i + 1].lat]),
        { units: 'kilometers' },
      );
      const dToCross = turf.distance(
        turf.point([points[i].lng, points[i].lat]),
        turf.point(crossPoint),
        { units: 'kilometers' },
      );

      const fraction = dTotal > 0 ? dToCross / dTotal : 0;
      const timeDelta = points[i + 1].timestamp - points[i].timestamp;
      const crossTimestamp = points[i].timestamp + fraction * timeDelta;

      return { timestamp: crossTimestamp, index: i + 1 };
    }
  }
  return null;
}

/** Race gate definition: either a single point (legacy) or an explicit line segment. */
export type StartFinishInput =
  | { coords: Coords }
  | { line: LineSegment };

function toGateLine(input: StartFinishInput): LineStringFeature {
  if ('line' in input) return segmentToLine(input.line);
  return buildGateLine(input.coords);
}

export function detectCrossings(
  points: GPSPoint[],
  start: StartFinishInput,
  finish: StartFinishInput,
): CrossingResult {
  if (points.length < 2) {
    throw new Error('Track must contain at least 2 GPS points');
  }

  const startGate = toGateLine(start);
  const finishGate = toGateLine(finish);

  const startCrossing = findCrossingTime(points, startGate);
  if (!startCrossing) {
    throw new Error(
      'Track did not cross the start line. Make sure you pass through the start point.',
    );
  }

  const finishCrossing = findCrossingTime(
    points,
    finishGate,
    startCrossing.index,
  );
  if (!finishCrossing) {
    throw new Error(
      'Track did not cross the finish line. Make sure you pass through the finish point after the start.',
    );
  }

  const elapsedTime = Math.round(finishCrossing.timestamp - startCrossing.timestamp);

  if (elapsedTime <= 0) {
    throw new Error('Invalid timing: finish timestamp is not after start timestamp.');
  }

  return {
    startTime: startCrossing.timestamp,
    finishTime: finishCrossing.timestamp,
    elapsedTime,
  };
}
