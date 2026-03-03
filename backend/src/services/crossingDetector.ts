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

/** Multi-stage: each stage has its own start and finish gate. */
export interface StageInput {
  start: StartFinishInput;
  finish: StartFinishInput;
}

export interface MultiStageResult {
  startTime: number;
  finishTime: number;
  elapsedTime: number;
  stageTimes: number[];
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

/**
 * Multi-stage: each stage has its own start and finish line.
 * For each stage in order, find first crossing of start then first crossing of finish;
 * stage time = finish - start. Total = sum of stage times.
 */
export function detectMultiStageCrossings(
  points: GPSPoint[],
  stages: StageInput[],
): MultiStageResult {
  if (points.length < 2) {
    throw new Error('Track must contain at least 2 GPS points');
  }
  if (stages.length === 0) {
    throw new Error('At least one stage is required');
  }

  const stageTimes: number[] = [];
  let currentIndex = 0;
  let firstStartTime = 0;
  let lastFinishTime = 0;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const startGate = toGateLine(stage.start);
    const finishGate = toGateLine(stage.finish);

    const startCrossing = findCrossingTime(points, startGate, currentIndex);
    if (!startCrossing) {
      throw new Error(
        `Track did not cross stage ${i + 1} start line. Make sure you pass through the start.`,
      );
    }
    if (i === 0) firstStartTime = startCrossing.timestamp;

    const finishCrossing = findCrossingTime(
      points,
      finishGate,
      startCrossing.index,
    );
    if (!finishCrossing) {
      throw new Error(
        `Track did not cross stage ${i + 1} finish line. Make sure you pass through the finish after the start.`,
      );
    }
    lastFinishTime = finishCrossing.timestamp;
    currentIndex = finishCrossing.index;

    const elapsed = Math.round(finishCrossing.timestamp - startCrossing.timestamp);
    if (elapsed <= 0) {
      throw new Error(
        `Invalid timing: stage ${i + 1} finish is not after start.`,
      );
    }
    stageTimes.push(elapsed);
  }

  const elapsedTime = stageTimes.reduce((a, b) => a + b, 0);
  return {
    startTime: firstStartTime,
    finishTime: lastFinishTime,
    elapsedTime,
    stageTimes,
  };
}
