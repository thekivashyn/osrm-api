const EARTH_RADIUS_M = 6_371_000;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Great-circle destination from (lng, lat) given initial bearing and distance in metres. */
export function destinationPoint(
  lng: number,
  lat: number,
  bearing: number,
  distanceM: number,
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(bearing);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [toDeg(λ2), toDeg(φ2)];
}

export function pointAlongBearing(origin: { lat: number; lng: number }, bearing: number, distanceM: number) {
  const [lng, lat] = destinationPoint(origin.lng, origin.lat, bearing, distanceM);
  return { lat, lng };
}

/** Rough centroid for GeoJSON Polygon / MultiPolygon rings. */
export function polygonCentroid(coords: unknown): { lat: number; lng: number } | null {
  let ring: number[][] | null = null;
  if (!coords || !Array.isArray(coords)) return null;
  if (Array.isArray(coords[0]?.[0]?.[0])) {
    ring = (coords as number[][][][])[0]?.[0] ?? null;
  } else if (Array.isArray(coords[0]?.[0])) {
    ring = (coords as number[][][])[0] ?? null;
  }
  if (!ring?.length) return null;
  let lngSum = 0;
  let latSum = 0;
  const n = ring.length - 1 > 0 ? ring.length - 1 : ring.length;
  for (let i = 0; i < n; i++) {
    lngSum += ring[i]![0]!;
    latSum += ring[i]![1]!;
  }
  return { lng: lngSum / n, lat: latSum / n };
}
