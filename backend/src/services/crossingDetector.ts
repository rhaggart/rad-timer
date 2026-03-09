/**
 * GPS track crossing detection: dead simple.
 * Start line and finish line are full segments (lat1,lng1 -> lat2,lng2).
 * We detect when the track crosses each line (side-of-line flip), interpolate
 * crossing time, then compute elapsed time. Track must cross start then finish.
 */

interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

/** Line segment: the full start or finish line as saved by the director. */
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

export type StartFinishInput =
  | { coords: { lat: number; lng: number } }
  | { line: LineSegment };

/** Turn coords (single point) into a short perpendicular line segment. */
function coordsToSegment(coords: { lat: number; lng: number }): LineSegment {
  const metersPerDegLat = 111320;
  const half = 7.5; // 15m total width (perpendicular to line)
  return {
    lat1: coords.lat + half / metersPerDegLat,
    lng1: coords.lng,
    lat2: coords.lat - half / metersPerDegLat,
    lng2: coords.lng,
  };
}

function toSegment(input: StartFinishInput): LineSegment {
  if ('line' in input) return input.line;
  return coordsToSegment(input.coords);
}

/**
 * Signed distance from point P to the infinite line through A and B.
 * Positive = one side, negative = other side, zero = on line.
 * Uses 2D cross product in (lng, lat) so we get a consistent sign for "left" vs "right".
 */
function sideOfLine(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/**
 * Check if point (qx,qy) lies on the segment from (ax,ay) to (bx,by).
 * Parameter t in [0,1]: q = a + t*(b-a). So t = dot(q-a, b-a) / dot(b-a, b-a).
 */
function isOnSegment(
  qx: number,
  qy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return qx === ax && qy === ay;
  const t = ((qx - ax) * dx + (qy - ay) * dy) / len2;
  return t >= 0 && t <= 1;
}

/**
 * Find the first time the track crosses the gate line (infinite line through the segment).
 * Uses side-of-line: when two consecutive points are on opposite sides (or one on the line), we crossed.
 * Interpolates crossing time. Optionally require crossing to be on the gate segment (when strictSegment is true).
 */
function findCrossingTime(
  points: GPSPoint[],
  gate: LineSegment,
  startIndex: number,
  allowFractionZero: boolean,
  strictSegment = false,
): { timestamp: number; index: number } | null {
  const ax = gate.lng1;
  const ay = gate.lat1;
  const bx = gate.lng2;
  const by = gate.lat2;

  for (let i = startIndex; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const s0 = sideOfLine(p0.lng, p0.lat, ax, ay, bx, by);
    const s1 = sideOfLine(p1.lng, p1.lat, ax, ay, bx, by);

    const crossed =
      s0 * s1 < 0 ||
      (s0 === 0 && (allowFractionZero || i > startIndex)) ||
      (s1 === 0 && (allowFractionZero || i > startIndex));
    if (!crossed) continue;

    let t: number;
    if (s0 === s1) {
      t = 0.5;
    } else {
      t = s0 / (s0 - s1);
    }
    t = Math.max(0, Math.min(1, t));

    const crossLng = p0.lng + t * (p1.lng - p0.lng);
    const crossLat = p0.lat + t * (p1.lat - p0.lat);
    if (strictSegment && !isOnSegment(crossLng, crossLat, ax, ay, bx, by)) continue;

    const crossTime = Math.round(p0.timestamp + t * (p1.timestamp - p0.timestamp));
    return { timestamp: crossTime, index: i + 1 };
  }
  return null;
}

/** Single crossing: first start, then first finish. Elapsed = finish time - start time. */
export function detectCrossings(
  points: GPSPoint[],
  start: StartFinishInput,
  finish: StartFinishInput,
): CrossingResult {
  if (points.length < 2) throw new Error('Track must contain at least 2 GPS points');

  const startSeg = toSegment(start);
  const finishSeg = toSegment(finish);

  const startCrossing = findCrossingTime(points, startSeg, 0, true);
  if (!startCrossing) {
    throw new Error('Track did not cross the start line. Make sure you pass through the start line.');
  }

  const finishCrossing = findCrossingTime(points, finishSeg, startCrossing.index, false);
  if (!finishCrossing) {
    throw new Error('Track did not cross the finish line. Make sure you pass through the finish line after the start.');
  }

  const elapsedTime = Math.round(finishCrossing.timestamp - startCrossing.timestamp);
  if (elapsedTime <= 0) {
    throw new Error('Invalid timing: finish must be after start.');
  }

  return {
    startTime: startCrossing.timestamp,
    finishTime: finishCrossing.timestamp,
    elapsedTime,
  };
}

export interface LapResult {
  startTime: number;
  finishTime: number;
  elapsedTime: number;
}

/** Multiple laps: each start→finish is one lap. Returns one result per lap. */
export function detectMultipleLaps(
  points: GPSPoint[],
  start: StartFinishInput,
  finish: StartFinishInput,
): LapResult[] {
  if (points.length < 2) throw new Error('Track must contain at least 2 GPS points');

  const startSeg = toSegment(start);
  const finishSeg = toSegment(finish);
  const laps: LapResult[] = [];
  let searchFrom = 0;

  while (true) {
    const startCrossing = findCrossingTime(points, startSeg, searchFrom, true);
    if (!startCrossing) break;

    const finishCrossing = findCrossingTime(points, finishSeg, startCrossing.index, false);
    if (!finishCrossing) break;

    const elapsedTime = Math.round(finishCrossing.timestamp - startCrossing.timestamp);
    if (elapsedTime <= 0) break;

    laps.push({
      startTime: startCrossing.timestamp,
      finishTime: finishCrossing.timestamp,
      elapsedTime,
    });
    searchFrom = finishCrossing.index;
  }

  if (laps.length === 0) {
    throw new Error(
      'Track did not cross the start line then the finish line. Make sure you pass through both.',
    );
  }
  return laps;
}

/** Multi-stage: each stage has start then finish. Total time = sum of stage times. */
export function detectMultiStageCrossings(
  points: GPSPoint[],
  stages: StageInput[],
): MultiStageResult {
  if (points.length < 2) throw new Error('Track must contain at least 2 GPS points');
  if (stages.length === 0) throw new Error('At least one stage is required');

  const stageTimes: number[] = [];
  let currentIndex = 0;
  let firstStartTime = 0;
  let lastFinishTime = 0;

  for (let i = 0; i < stages.length; i++) {
    const startSeg = toSegment(stages[i].start);
    const finishSeg = toSegment(stages[i].finish);

    const startCrossing = findCrossingTime(
      points,
      startSeg,
      currentIndex,
      i === 0 && currentIndex === 0,
    );
    if (!startCrossing) {
      throw new Error(
        `Track did not cross stage ${i + 1} start line. Make sure you pass through the start.`,
      );
    }
    if (i === 0) firstStartTime = startCrossing.timestamp;

    const finishCrossing = findCrossingTime(points, finishSeg, startCrossing.index, false);
    if (!finishCrossing) {
      throw new Error(
        `Track did not cross stage ${i + 1} finish line. Make sure you pass through the finish after the start.`,
      );
    }
    lastFinishTime = finishCrossing.timestamp;
    currentIndex = finishCrossing.index;

    const elapsed = Math.round(finishCrossing.timestamp - startCrossing.timestamp);
    if (elapsed <= 0) {
      throw new Error(`Invalid timing: stage ${i + 1} finish must be after start.`);
    }
    stageTimes.push(elapsed);
  }

  return {
    startTime: firstStartTime,
    finishTime: lastFinishTime,
    elapsedTime: stageTimes.reduce((a, b) => a + b, 0),
    stageTimes,
  };
}
</think>
Fixing a typo in the crossing-point calculation:
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace