import { config } from "../config/env";
import { AppError } from "../utils/response";
import { TtlCache } from "../utils/ttl-cache";
import {
  getBuildingManifest,
  isLocalBuildingIndexReady,
  queryLocalBuildingFootprints,
} from "./building-local.store";
import type { GeoJsonFeatureCollection } from "./building.types";

const MAX_BBOX_SPAN = 0.012; // ~1.3 km — crop center if viewport larger
const CACHE_TTL_MS = 86_400_000; // 24 h — building geometry is stable

export type { GeoJsonFeatureCollection } from "./building.types";

const cache = new TtlCache<GeoJsonFeatureCollection>(CACHE_TTL_MS);

function cacheKey(south: number, west: number, north: number, east: number): string {
  const r = (v: number) => v.toFixed(4);
  return `${r(south)}:${r(west)}:${r(north)}:${r(east)}`;
}

function clampBbox(
  south: number,
  west: number,
  north: number,
  east: number,
): { south: number; west: number; north: number; east: number } {
  const latSpan = north - south;
  const lngSpan = east - west;
  if (latSpan <= MAX_BBOX_SPAN && lngSpan <= MAX_BBOX_SPAN) {
    return { south, west, north, east };
  }
  const cLat = (south + north) / 2;
  const cLng = (west + east) / 2;
  const half = MAX_BBOX_SPAN / 2;
  return {
    south: cLat - half,
    north: cLat + half,
    west: cLng - half,
    east: cLng + half,
  };
}

function validateBbox(south: number, west: number, north: number, east: number): void {
  if (![south, west, north, east].every(Number.isFinite)) {
    throw new AppError("Invalid bbox coordinates", 400);
  }
  if (south >= north || west >= east) {
    throw new AppError("Invalid bbox: south must be < north and west < east", 400);
  }
}

const empty: GeoJsonFeatureCollection = { type: "FeatureCollection", features: [] };

let indexMissingLogged = false;

function logIndexMissingOnce(): void {
  if (indexMissingLogged) return;
  indexMissingLogged = true;
  console.warn(
    `[buildings] Local index not found. Run: bun run buildings:extract (uses ${config.buildingsSourcePbf})`,
  );
}

export async function fetchBuildingFootprints(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<GeoJsonFeatureCollection> {
  validateBbox(south, west, north, east);
  const box = clampBbox(south, west, north, east);
  const key = cacheKey(box.south, box.west, box.north, box.east);
  const hit = cache.get(key);
  if (hit) return hit;

  if (!isLocalBuildingIndexReady()) {
    logIndexMissingOnce();
    cache.set(key, empty);
    return empty;
  }

  const manifest = await getBuildingManifest();
  if (manifest?.sourceMtimeMs) {
    // Invalidate cache if index was rebuilt (manifest reread each cold start is enough for dev).
  }

  const geojson = await queryLocalBuildingFootprints(box.south, box.west, box.north, box.east);
  const result = geojson ?? empty;
  cache.set(key, result);
  return result;
}

/** Test helper — reset warning flag. */
export function resetBuildingServiceState(): void {
  indexMissingLogged = false;
  cache.clear();
}
