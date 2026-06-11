/** Typical frontage depth per house number inside a VN urban alley (metres). */
export const ALLEY_HOUSE_SPACING_M = 5;

/** If mouth↔anchor distance is below this, crowd GPS is too coarse — use spacing heuristic. */
const MIN_MOUTH_ANCHOR_M = 8;

/** Default bearing (degrees, 0=north) when alley direction is unknown — into block from E-W roads in HCM. */
const DEFAULT_ALLEY_BEARING_DEG = 190;

const EARTH_RADIUS_M = 6_371_000;

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

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Linear interpolate/extrapolate lat/lng from two house-number anchors. */
export function interpolateHouseAnchors(
  a: { house: number; lat: number; lng: number },
  b: { house: number; lat: number; lng: number },
  target: number,
): [number, number] {
  if (a.house === b.house) return [a.lng, a.lat];
  const t = (target - a.house) / (b.house - a.house);
  return [a.lng + (b.lng - a.lng) * t, a.lat + (b.lat - a.lat) * t];
}

export type AlleyAnchor = { house: number; lat: number; lng: number };

/**
 * Estimate coordinates for house `target` inside an alley.
 * Uses multiple crowd pins when available; otherwise depth from OSM alley mouth.
 */
export function estimateAlleyHousePosition(
  target: number,
  mouth: { lat: number; lng: number } | null,
  anchors: AlleyAnchor[],
): [number, number] | null {
  const sorted = [...anchors].sort((a, b) => a.house - b.house);
  if (sorted.length >= 2) {
    if (target <= sorted[0]!.house) {
      return interpolateHouseAnchors(sorted[0]!, sorted[1]!, target);
    }
    if (target >= sorted[sorted.length - 1]!.house) {
      const last = sorted[sorted.length - 1]!;
      const prev = sorted[sorted.length - 2]!;
      return interpolateHouseAnchors(prev, last, target);
    }
    for (let i = 0; i < sorted.length - 1; i++) {
      const lo = sorted[i]!;
      const hi = sorted[i + 1]!;
      if (target >= lo.house && target <= hi.house) {
        return interpolateHouseAnchors(lo, hi, target);
      }
    }
  }

  if (mouth) {
    const ref = sorted[0];
    const distMk =
      ref != null ? haversineM(mouth.lat, mouth.lng, ref.lat, ref.lng) : 0;

    if (ref && distMk >= MIN_MOUTH_ANCHOR_M) {
      // Crowd pin is far enough from mouth — scale along mouth→anchor ray.
      return interpolateHouseAnchors(
        { house: 0, lat: mouth.lat, lng: mouth.lng },
        { house: ref.house, lat: ref.lat, lng: ref.lng },
        target,
      );
    }

    const brng =
      ref && distMk >= MIN_MOUTH_ANCHOR_M
        ? bearingDeg(mouth.lat, mouth.lng, ref.lat, ref.lng)
        : DEFAULT_ALLEY_BEARING_DEG;
    const depthM = target * ALLEY_HOUSE_SPACING_M;
    return destinationPoint(mouth.lng, mouth.lat, brng, depthM);
  }

  if (sorted.length === 1) {
    const ref = sorted[0]!;
    const brng = DEFAULT_ALLEY_BEARING_DEG;
    const delta = (target - ref.house) * ALLEY_HOUSE_SPACING_M;
    return destinationPoint(ref.lng, ref.lat, brng, delta);
  }

  return null;
}
