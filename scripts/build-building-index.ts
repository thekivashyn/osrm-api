#!/usr/bin/env bun
/**
 * Extract building footprints from vietnam-latest.osm.pbf into a grid tile index.
 * Usage: bun scripts/build-building-index.ts [--pbf path] [--out path]
 */
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import osmPbfParser from "osm-pbf-parser";
import type { BuildingFeature, BuildingManifest } from "../src/services/building.types";

const CELL_DEG = Number(process.env.BUILDINGS_CELL_DEG ?? 0.005);

type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> };
type OsmWay = {
  type: "way";
  id: number;
  refs: number[];
  tags?: Record<string, string>;
};
type OsmRelation = {
  type: "relation";
  id: number;
  members: Array<{ type: string; id: number; role: string }>;
  tags?: Record<string, string>;
};
type OsmItem = OsmNode | OsmWay | OsmRelation;

type StoredWay = { id: number; tags: Record<string, string>; refs: number[] };

function parseArgs(): { pbf: string; out: string } {
  const args = process.argv.slice(2);
  let pbf = join(process.cwd(), "data", "vietnam-latest.osm.pbf");
  let out = join(process.cwd(), "data", "buildings");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pbf" && args[i + 1]) pbf = resolve(args[++i]!);
    else if (args[i] === "--out" && args[i + 1]) out = resolve(args[++i]!);
  }
  return { pbf, out };
}

async function scanPbf(pbfPath: string): Promise<{
  buildingWays: StoredWay[];
  memberWayIds: Set<number>;
  relationMultipolygons: Array<{
    id: number;
    tags: Record<string, string>;
    members: OsmRelation["members"];
  }>;
}> {
  const buildingWays: StoredWay[] = [];
  const relationMultipolygons: Array<{
    id: number;
    tags: Record<string, string>;
    members: OsmRelation["members"];
  }> = [];

  await streamPbf(pbfPath, (batch) => {
    for (const item of batch as OsmItem[]) {
      if (item.type === "way" && item.tags?.building && item.refs?.length >= 3) {
        buildingWays.push({ id: item.id, tags: item.tags, refs: item.refs });
      } else if (
        item.type === "relation" &&
        item.tags?.building &&
        item.tags?.type === "multipolygon"
      ) {
        relationMultipolygons.push({
          id: item.id,
          tags: item.tags,
          members: item.members ?? [],
        });
      }
    }
  });

  const memberWayIds = new Set<number>();
  for (const rel of relationMultipolygons) {
    for (const m of rel.members) {
      if (m.type === "way") memberWayIds.add(m.id);
    }
  }

  return { buildingWays, memberWayIds, relationMultipolygons };
}

async function loadNodesAndMemberWays(
  pbfPath: string,
  nodeIds: Set<number>,
  memberWayIds: Set<number>,
): Promise<{ nodeMap: Map<number, [number, number]>; memberWays: Map<number, number[]> }> {
  const memberWays = new Map<number, number[]>();

  await streamPbf(pbfPath, (batch) => {
    for (const item of batch as OsmItem[]) {
      if (item.type === "way" && memberWayIds.has(item.id) && item.refs?.length) {
        memberWays.set(item.id, item.refs);
        for (const ref of item.refs) nodeIds.add(ref);
      }
    }
  });

  const nodeMap = new Map<number, [number, number]>();
  await streamPbf(pbfPath, (batch) => {
    for (const item of batch as OsmItem[]) {
      if (item.type === "node" && nodeIds.has(item.id)) {
        nodeMap.set(item.id, [item.lon, item.lat]);
      }
    }
  });

  return { nodeMap, memberWays };
}

async function streamPbf(
  pbfPath: string,
  onBatch: (batch: unknown[]) => void | Promise<void>,
): Promise<void> {
  const parser = osmPbfParser();
  let pending = Promise.resolve();
  parser.on("data", (batch: unknown[]) => {
    pending = pending.then(() => onBatch(batch));
  });
  await pipeline(createReadStream(pbfPath), parser);
  await pending;
}

function refsToRing(refs: number[], nodeMap: Map<number, [number, number]>): [number, number][] | null {
  const ring: [number, number][] = [];
  for (const ref of refs) {
    const pt = nodeMap.get(ref);
    if (!pt) return null;
    ring.push(pt);
  }
  if (ring.length < 3) return null;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return ring;
}

function wayToFeature(way: StoredWay, nodeMap: Map<number, [number, number]>): BuildingFeature | null {
  const ring = refsToRing(way.refs, nodeMap);
  if (!ring) return null;
  return {
    type: "Feature",
    properties: { id: way.id, building: way.tags.building },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

function relationToFeatures(
  rel: { id: number; tags: Record<string, string>; members: OsmRelation["members"] },
  memberWays: Map<number, number[]>,
  nodeMap: Map<number, [number, number]>,
): BuildingFeature[] {
  const outers = rel.members.filter((m) => m.type === "way" && (m.role === "outer" || m.role === ""));
  const features: BuildingFeature[] = [];
  for (const m of outers) {
    const refs = memberWays.get(m.id);
    if (!refs) continue;
    const ring = refsToRing(refs, nodeMap);
    if (!ring) continue;
    features.push({
      type: "Feature",
      properties: { id: rel.id, building: rel.tags.building },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }
  return features;
}

function ringBbox(ring: [number, number][]): {
  south: number;
  west: number;
  north: number;
  east: number;
} {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const [lng, lat] of ring) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return { south, west, north, east };
}

function cellsForRing(ring: [number, number][], cellDeg: number): Array<{ iy: number; ix: number }> {
  const { south, west, north, east } = ringBbox(ring);
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

function tileKey(iy: number, ix: number): string {
  return `${iy}/${ix}`;
}

async function writeTiles(
  outDir: string,
  features: BuildingFeature[],
  cellDeg: number,
): Promise<number> {
  const tiles = new Map<string, BuildingFeature[]>();

  for (const feature of features) {
    const ring = feature.geometry.coordinates[0];
    if (!ring?.length) continue;
    for (const { iy, ix } of cellsForRing(ring, cellDeg)) {
      const key = tileKey(iy, ix);
      let list = tiles.get(key);
      if (!list) {
        list = [];
        tiles.set(key, list);
      }
      list.push(feature);
    }
  }

  const tilesDir = join(outDir, "tiles");
  rmSync(tilesDir, { recursive: true, force: true });

  let written = 0;
  for (const [key, tileFeatures] of tiles) {
    const [iy, ix] = key.split("/");
    const dir = join(tilesDir, iy!);
    mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ type: "FeatureCollection", features: tileFeatures });
    const gz = Bun.gzipSync(payload);
    await Bun.write(join(dir, `${ix}.json.gz`), gz);
    written++;
  }
  return written;
}

async function main(): Promise<void> {
  const { pbf, out } = parseArgs();
  if (!existsSync(pbf)) {
    console.error(`Missing PBF: ${pbf}`);
    console.error("Run: bun run osrm:prepare");
    process.exit(1);
  }

  const pbfStat = statSync(pbf);
  console.log(`Source: ${pbf} (${(pbfStat.size / 1e6).toFixed(1)} MB)`);
  console.log(`Output: ${out}`);
  console.log(`Cell size: ${CELL_DEG}° (~${(CELL_DEG * 111).toFixed(2)} km)`);

  console.log("Pass 1/3 — scan building ways & relations...");
  const t0 = Date.now();
  const { buildingWays, memberWayIds, relationMultipolygons } = await scanPbf(pbf);
  console.log(
    `  ${buildingWays.length.toLocaleString()} building ways, ${relationMultipolygons.length.toLocaleString()} multipolygon relations (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );

  const nodeIds = new Set<number>();
  for (const w of buildingWays) {
    for (const ref of w.refs) nodeIds.add(ref);
  }

  console.log("Pass 2/3 — load nodes & relation member ways...");
  const t1 = Date.now();
  const { nodeMap, memberWays } = await loadNodesAndMemberWays(pbf, nodeIds, memberWayIds);
  console.log(
    `  ${nodeMap.size.toLocaleString()} nodes, ${memberWays.size.toLocaleString()} member ways (${((Date.now() - t1) / 1000).toFixed(1)}s)`,
  );

  console.log("Pass 3/3 — assemble polygons & write tiles...");
  const t2 = Date.now();
  const features: BuildingFeature[] = [];
  let skipped = 0;

  for (const way of buildingWays) {
    const f = wayToFeature(way, nodeMap);
    if (f) features.push(f);
    else skipped++;
  }

  for (const rel of relationMultipolygons) {
    features.push(...relationToFeatures(rel, memberWays, nodeMap));
  }

  mkdirSync(out, { recursive: true });
  const tileCount = await writeTiles(out, features, CELL_DEG);

  const manifest: BuildingManifest = {
    version: 1,
    cellDeg: CELL_DEG,
    sourcePbf: pbf,
    sourceMtimeMs: pbfStat.mtimeMs,
    featureCount: features.length,
    tileCount,
    builtAt: new Date().toISOString(),
  };
  await Bun.write(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    `Done: ${features.length.toLocaleString()} features → ${tileCount.toLocaleString()} tiles (skipped ${skipped}) in ${((Date.now() - t2) / 1000).toFixed(1)}s`,
  );
  console.log(`Total: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
