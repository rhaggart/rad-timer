/**
 * Compute the two endpoints of a line segment centered at (lat, lng)
 * with given length (meters) and angle (degrees: 0 = North, 90 = East).
 */
export function segmentFromCenter(
  center: { lat: number; lng: number },
  angleDeg: number,
  lengthMeters: number
): { lat1: number; lng1: number; lat2: number; lng2: number } {
  const half = lengthMeters / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const latRad = (center.lat * Math.PI) / 180;
  const dLat = (half / 111320) * Math.cos(rad);
  const dLng =
    (half / (111320 * Math.cos(latRad))) * Math.sin(rad);
  return {
    lat1: center.lat + dLat,
    lng1: center.lng + dLng,
    lat2: center.lat - dLat,
    lng2: center.lng - dLng,
  };
}
