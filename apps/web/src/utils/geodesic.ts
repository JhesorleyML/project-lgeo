/**
 * Pure WGS84 (EPSG:4326) Geodesic & Coordinate Utilities
 * Adheres to AGENTS.md Section 4.1:
 * - Strict [longitude, latitude] axis order
 * - Spheroidal metric calculations (meters, kilometers, sq. meters, hectares)
 * - Philippine bounding box validation (lng 116.0..127.0, lat 4.0..21.5)
 */

const EARTH_RADIUS_METERS = 6_371_008.8; // IUGG mean earth radius in meters

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes spheroidal Haversine distance in meters between two [lng, lat] points (EPSG:4326).
 */
export function computeHaversineDistanceMeters(
  p1: readonly [number, number],
  p2: readonly [number, number],
): number {
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes cumulative geodesic polyline length in meters across an ordered array of [lng, lat] vertices.
 */
export function computePolylineDistanceMeters(
  coords: readonly (readonly [number, number])[],
): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += computeHaversineDistanceMeters(coords[i - 1]!, coords[i]!);
  }
  return total;
}

/**
 * Computes spheroidal polygon area in square meters using spherical excess formula on WGS84 coordinates.
 */
export function computeGeodesicPolygonAreaSqMeters(
  coords: readonly (readonly [number, number])[],
): number {
  if (coords.length < 3) return 0;
  const ring = [...coords];
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i]!;
    const [lng2, lat2] = ring[i + 1]!;
    total += toRadians(lng2 - lng1) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }

  return Math.abs((total * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2.0);
}

/**
 * Formats a metric distance in meters (`m`) or kilometers (`km`).
 */
export function formatDistanceMetric(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(1)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Formats a metric area into both square meters (`m²`) and hectares (`ha`).
 */
export function formatAreaMetric(sqMeters: number): { sqMeters: string; hectares: string } {
  const ha = sqMeters / 10_000;
  return {
    sqMeters: `${Math.round(sqMeters).toLocaleString()} m²`,
    hectares: `${ha.toFixed(2)} ha`,
  };
}

function decimalToDms(deg: number, isLng: boolean): string {
  const dir = isLng ? (deg >= 0 ? 'E' : 'W') : deg >= 0 ? 'N' : 'S';
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = ((minFloat - m) * 60).toFixed(1);
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(4, '0')}"${dir}`;
}

/**
 * Formats [longitude, latitude] in either Decimal Degrees ('dd') or Degrees-Minutes-Seconds ('dms').
 */
export function formatCoordinate(
  lng: number,
  lat: number,
  format: 'dd' | 'dms',
): { lngText: string; latText: string; combined: string } {
  if (format === 'dms') {
    const lngText = decimalToDms(lng, true);
    const latText = decimalToDms(lat, false);
    return { lngText, latText, combined: `${latText}, ${lngText}` };
  }
  const lngText = `${lng.toFixed(5)}° E`;
  const latText = `${lat.toFixed(5)}° N`;
  return { lngText, latText, combined: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
}

/**
 * Parses a user search string as either `lat, lng` or `lng, lat` within valid Philippine bounds:
 * longitude BETWEEN 116.0 AND 127.0, latitude BETWEEN 4.0 AND 21.5
 */
export function parseCoordinateQuery(input: string): { lng: number; lat: number } | null {
  const cleaned = input.trim().replace(/[°NESWnesw]/g, '');
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  if (parts.length !== 2) return null;

  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  const isValidPh = (lng: number, lat: number) =>
    lng >= 116.0 && lng <= 127.0 && lat >= 4.0 && lat <= 21.5;

  // Check [lat, lng] order (common when pasting from GPS/maps)
  if (isValidPh(b, a)) {
    return { lng: b, lat: a };
  }
  // Check [lng, lat] order (canonical PostGIS X, Y order)
  if (isValidPh(a, b)) {
    return { lng: a, lat: b };
  }
  return null;
}
