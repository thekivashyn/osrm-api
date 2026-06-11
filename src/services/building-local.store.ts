import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BuildingManifest, GeoJsonFeatureCollection } from "./building.types";

const DEFAULT_CELL_DEG = 0.005;

let manifest: BuildingManifest | null = null;
let manifestPath: string | null = null;

function resolveDataDir(): string {
  return process.env.BUILDINGS_DATA_DIR ?? join(process.cwd(), "data", "buildings");
}

export function getBuildingsDataDir(): string {
  return resolveDataDir();
}

export function isLocalBuildingIndexReady(): boolean {
  const dir = resolveDataDir();
  const path = join(dir, "manifest.json");
  if (!existsSync(path)) return false;
  return true;
}

export async function getBuildingManifest(): Promise<BuildingManifest | null> {
  const dir = resolveDataDir();
  const path = join(dir, "manifest.json");
  if (manifest && manifestPath === path) return manifest;
  if (!existsSync(path)) return null;
  try {
    manifest = (await Bun.file(path).json()) as BuildingManifest;
    manifestPath = path;
    return manifest;
  } catch {
    return null;
  }
}

function tilePath(dir: string, iy: number, ix: number): string {
  return join(dir, "tiles", String(iy), `${ix}.json.gz`);
}

function cellsForBbox(
  south: number,
  west: number,
  north: number,
  east: number,
  cellDeg: number,
): Array<{ iy: number; ix: number }> {
  const iyMin = Math.floor(south / cellDeg);
  const iyMax = Math.floor(north / cellDeg);
  const ixMin = Math.floor(west / cellDeg);
  const ixMax = Math.floor(east / cellDeg);
  const cells: Array<{ iy: number; ix: number }> = [];
  for (let iy = iyMin; iy <= iyMax; iy++) {
    for (let ix = ixMin; ix <= ixMax; ix++) {
      cells.push({ iy, ix });
    }
  }
  return cells;
}

function featureIntersectsBbox(
  feature: GeoJsonFeatureCollection["features"][0],
  south: number,
  west: number,
  north: number,
  east: number,
): boolean {
  const ring = feature.geometry.coordinates[0];
  if (!ring?.length) return false;
  for (const [lng, lat] of ring) {
    if (lat >= south && lat <= north && lng >= west && lng <= east) return true;
  }
  return false;
}

async function readTile(
  dir: string,
  iy: number,
  ix: number,
): Promise<GeoJsonFeatureCollection | null> {
  const path = tilePath(dir, iy, ix);
  if (!existsSync(path)) return null;
  try {
    const buf = await Bun.file(path).arrayBuffer();
    const json = Bun.gunzipSync(new Uint8Array(buf));
    return JSON.parse(new TextDecoder().decode(json)) as GeoJsonFeatureCollection;
  } catch {
    return null;
  }
}

export async function queryLocalBuildingFootprints(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<GeoJsonFeatureCollection | null> {
  const dir = resolveDataDir();
  const meta = await getBuildingManifest();
  if (!meta) return null;

  const cellDeg = meta.cellDeg || DEFAULT_CELL_DEG;
  const cells = cellsForBbox(south, west, north, east, cellDeg);
  const byId = new Map<number, GeoJsonFeatureCollection["features"][0]>();

  await Promise.all(
    cells.map(async ({ iy, ix }) => {
      const tile = await readTile(dir, iy, ix);
      if (!tile) return;
      for (const f of tile.features) {
        if (featureIntersectsBbox(f, south, west, north, east)) {
          byId.set(f.properties.id, f);
        }
      }
    }),
  );

  return { type: "FeatureCollection", features: [...byId.values()] };
}

/** Clear cached manifest (tests). */
export function resetBuildingStoreCache(): void {
  manifest = null;
  manifestPath = null;
}
