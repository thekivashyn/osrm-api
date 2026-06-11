import type { Point } from "../types";

export type SearchBiasSource = "gps" | "map" | "default";

export type SearchBias = Point & { source: SearchBiasSource };

/** ~1 km — map still "near" user GPS for search bias. */
const GPS_MAP_MERGE_DEG = 0.01;

export function resolveSearchBias(
  userGps: Point | null,
  mapCenter: Point | null,
  fallback: Point,
): SearchBias {
  if (userGps && mapCenter) {
    const dLat = Math.abs(mapCenter.lat - userGps.lat);
    const dLng = Math.abs(mapCenter.lng - userGps.lng);
    if (dLat < GPS_MAP_MERGE_DEG && dLng < GPS_MAP_MERGE_DEG) {
      return { ...userGps, source: "gps" };
    }
    return { ...mapCenter, source: "map" };
  }
  if (userGps) return { ...userGps, source: "gps" };
  if (mapCenter) return { ...mapCenter, source: "map" };
  return { ...fallback, source: "default" };
}

export function searchBiasLabel(source: SearchBiasSource): string {
  if (source === "gps") return "GPS · Geo";
  if (source === "map") return "Map · Geo";
  return "Geo";
}
