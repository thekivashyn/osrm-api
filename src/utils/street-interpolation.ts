import { normalizeAdminText } from "../services/vn-admin";
import {
  bearingDeg,
  destinationPoint,
  interpolateHouseAnchors,
  type AlleyAnchor,
} from "./alley-geometry";

/** Typical frontage spacing on a VN urban main road (metres). */
export const STREET_HOUSE_SPACING_M = 8;

export type StreetSnapInput = { house: string; street: string };

export type StreetAnchor = AlleyAnchor;

type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

type StreetSnapFeature = {
  type?: "Feature";
  geometry: { type?: "Point"; coordinates: [number, number] };
  properties?: {
    layer?: string;
    name?: string;
    label?: string;
    street?: string;
    housenumber?: string;
    match_type?: string;
    region?: string;
    locality?: string;
    bbox?: Bbox | [number, number, number, number];
  };
  bbox?: [number, number, number, number];
};

/** "865 Nguyễn Xiển" — plain house on a main street (not alley compound). */
export function parsePlainHouseStreet(head: string): StreetSnapInput | null {
  const trimmed = head.trim();
  if (/^(hẻm|ngõ|ngách)\s/i.test(trimmed)) return null;
  if (/\d+\/\d+/.test(trimmed)) return null;
  const m = trimmed.match(/^(\d+[A-Za-z]?)\s+(.{2,80})$/);
  if (!m) return null;
  const street = m[2]!.trim();
  if (/^(hẻm|ngõ|ngách)\s/i.test(street)) return null;
  return { house: m[1]!, street };
}

export function streetNormFromQuery(street: string): string {
  return normalizeAdminText(street.replace(/^(đường|duong)\s+/i, ""));
}

function featureText(f: StreetSnapFeature): string {
  const p = f.properties ?? {};
  return normalizeAdminText(`${p.name ?? ""} ${p.street ?? ""} ${p.label ?? ""}`);
}

export function matchesMainStreetFeature(f: StreetSnapFeature, streetNorm: string): boolean {
  const p = f.properties ?? {};
  if (p.layer !== "street") return false;
  const text = featureText(f);
  if (/^(hem|ngo|ngach)\s/.test(text)) return false;
  return text.includes(streetNorm);
}

/** Parse a house number from venue/address labels on the same street. */
export function parseHouseFromVenueLabel(text: string, streetNorm: string): number | null {
  const norm = normalizeAdminText(text);
  if (!norm.includes(streetNorm)) return null;

  const streetEsc = streetNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const beforeStreet = norm.match(new RegExp(`(?:so\\s+)?(\\d{1,5})\\s+${streetEsc}(?:\\s|,|$)`));
  if (beforeStreet) {
    const n = Number(beforeStreet[1]);
    return Number.isFinite(n) ? n : null;
  }

  const nums = [...norm.matchAll(/\b(\d{1,5})\b/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 99_999);
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0]!;

  // "CH Lẻ : 1290 Nguyễn Xiển" — pick the number closest to street token.
  const idx = norm.indexOf(streetNorm);
  let best: number | null = null;
  let bestDist = Infinity;
  for (const n of nums) {
    const pos = norm.indexOf(String(n));
    if (pos < 0) continue;
    const dist = Math.abs(pos - idx);
    if (dist < bestDist) {
      bestDist = dist;
      best = n;
    }
  }
  return best;
}

function houseFromAddressFeature(f: StreetSnapFeature, streetNorm: string): number | null {
  const p = f.properties ?? {};
  if (p.layer !== "address" || !p.housenumber) return null;
  if (/\//.test(p.housenumber)) return null;
  const hn = p.housenumber.match(/^(\d+)/);
  if (!hn) return null;
  const streetText = normalizeAdminText(`${p.street ?? ""} ${p.name ?? ""}`);
  if (!streetText.includes(streetNorm)) return null;
  return Number(hn[1]);
}

export function collectStreetAnchors(
  features: StreetSnapFeature[],
  streetNorm: string,
): StreetAnchor[] {
  const anchors: StreetAnchor[] = [];
  const seen = new Set<number>();

  for (const f of features) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry.coordinates;
    let house: number | null = null;

    if (p.layer === "address") {
      house = houseFromAddressFeature(f, streetNorm);
    } else if (p.layer === "venue") {
      house = parseHouseFromVenueLabel(`${p.name ?? ""} ${p.label ?? ""}`, streetNorm);
    }

    if (house == null || !Number.isFinite(house) || seen.has(house)) continue;
    seen.add(house);
    anchors.push({ house, lat, lng });
  }

  return anchors.sort((a, b) => a.house - b.house);
}

function bboxFromFeature(f: StreetSnapFeature): Bbox | null {
  const raw = f.bbox ?? f.properties?.bbox;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const [minLng, minLat, maxLng, maxLat] = raw;
    return { minLng, minLat, maxLng, maxLat };
  }
  return raw;
}

function streetReferencePoint(
  features: StreetSnapFeature[],
  streetNorm: string,
): { lat: number; lng: number; bearing?: number } | null {
  const streets = features.filter((f) => matchesMainStreetFeature(f, streetNorm));
  if (streets.length === 0) return null;

  const f = streets[0]!;
  const [lng, lat] = f.geometry.coordinates;
  const bb = bboxFromFeature(f);
  if (!bb) return { lat, lng };

  const latSpan = bb.maxLat - bb.minLat;
  const lngSpan = bb.maxLng - bb.minLng;
  if (latSpan >= lngSpan) {
    return {
      lat: (bb.minLat + bb.maxLat) / 2,
      lng: (bb.minLng + bb.maxLng) / 2,
      bearing: bb.maxLat > bb.minLat ? 0 : 180,
    };
  }
  return {
    lat: (bb.minLat + bb.maxLat) / 2,
    lng: (bb.minLng + bb.maxLng) / 2,
    bearing: bb.maxLng > bb.minLng ? 90 : 270,
  };
}

/**
 * Estimate coordinates for house `target` on a main street from crowd pins
 * (address layer + POI names with house numbers) and the street centroid.
 */
export function estimateStreetHousePosition(
  target: number,
  streetRef: { lat: number; lng: number; bearing?: number } | null,
  anchors: StreetAnchor[],
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

  if (sorted.length === 1) {
    const ref = sorted[0]!;
    if (streetRef) {
      return interpolateHouseAnchors(
        { house: 0, lat: streetRef.lat, lng: streetRef.lng },
        ref,
        target,
      );
    }
    const delta = (target - ref.house) * STREET_HOUSE_SPACING_M;
    return destinationPoint(ref.lng, ref.lat, 90, delta);
  }

  if (streetRef) {
    const brng = streetRef.bearing ?? 90;
    const depthM = target * STREET_HOUSE_SPACING_M;
    return destinationPoint(streetRef.lng, streetRef.lat, brng, depthM);
  }

  return null;
}

export function snapToStreetHouse(
  features: StreetSnapFeature[],
  snap: StreetSnapInput,
): { feature: StreetSnapFeature; estimated: boolean } | null {
  const streetNorm = streetNormFromQuery(snap.street);
  const target = Number(snap.house.replace(/[^\d].*$/, ""));
  if (!Number.isFinite(target)) return null;

  const anchors = collectStreetAnchors(features, streetNorm);
  const streetRef = streetReferencePoint(features, streetNorm);

  const exact = features.find((f) => {
    const hn = f.properties?.housenumber;
    if (f.properties?.layer !== "address" || !hn) return false;
    return hn === snap.house || hn === String(target);
  });
  if (exact) return { feature: exact, estimated: false };

  const exactAnchor = anchors.find((a) => a.house === target);
  if (exactAnchor) {
    const template =
      features.find((f) => f.properties?.layer === "address") ??
      features.find((f) => matchesMainStreetFeature(f, streetNorm)) ??
      features[0];
    if (!template) return null;
    return {
      feature: {
        ...template,
        geometry: { type: "Point" as const, coordinates: [exactAnchor.lng, exactAnchor.lat] },
        properties: {
          ...template.properties,
          name: `${snap.house} ${snap.street}`,
          housenumber: snap.house,
          street: snap.street,
          layer: "address",
          match_type: "exact",
        },
      },
      estimated: false,
    };
  }

  const estimated = estimateStreetHousePosition(target, streetRef, anchors);
  if (!estimated) return null;

  const [estLng, estLat] = estimated;
  const template =
    features.find((f) => f.properties?.layer === "address") ??
    features.find((f) => matchesMainStreetFeature(f, streetNorm)) ??
    features.find((f) => f.properties?.layer === "venue") ??
    features[0];
  if (!template) return null;

  return {
    feature: {
      ...template,
      geometry: { type: "Point" as const, coordinates: [estLng, estLat] },
      properties: {
        ...template.properties,
        name: `${snap.house} ${snap.street}`,
        housenumber: snap.house,
        street: snap.street,
        layer: "address",
        match_type: "interpolated",
      },
    },
    estimated: true,
  };
}

/** Bearing between two anchor points — fallback when street bbox is missing. */
export function anchorBearing(a: StreetAnchor, b: StreetAnchor): number {
  return bearingDeg(a.lat, a.lng, b.lat, b.lng);
}
