#!/usr/bin/env bun
/**
 * Extract addr:housenumber + addr:street from vietnam-latest.osm.pbf → Pelias CSV.
 *
 * Usage:
 *   bun scripts/extract-osm-addresses.ts [--pbf path] [--out path]
 *   bun run addresses:extract
 *
 * Import on server (after copy/sync CSV):
 *   cd pelias/vietnam && ../../.pelias-docker/pelias import csv
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import osmPbfParser from "osm-pbf-parser";
import { normalizeAdminText } from "../src/services/vn-admin";

type OsmNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};
type OsmWay = {
  type: "way";
  id: number;
  refs: number[];
  tags?: Record<string, string>;
};
type OsmItem = OsmNode | OsmWay;

type AddrRow = {
  id: string;
  name: string;
  housenumber: string;
  street: string;
  lat: number;
  lon: number;
};

function parseArgs(): { pbf: string; outDir: string } {
  const args = process.argv.slice(2);
  let pbf = join(process.cwd(), "data", "vietnam-latest.osm.pbf");
  let outDir = join(process.cwd(), "data", "custom-addresses");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--pbf" && args[i + 1]) pbf = resolve(args[++i]!);
    else if (args[i] === "--out" && args[i + 1]) outDir = resolve(args[++i]!);
  }
  return { pbf, outDir };
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function isValidHouseNumber(hn: string): boolean {
  if (!hn || hn.length > 32) return false;
  return /^[\d]+[A-Za-z]?(?:\/[\d]+[A-Za-z]?)*$/.test(hn.trim());
}

async function streamPbf(
  pbfPath: string,
  onBatch: (batch: OsmItem[]) => void | Promise<void>,
): Promise<void> {
  const parser = osmPbfParser();
  let pending = Promise.resolve();
  parser.on("data", (batch: OsmItem[]) => {
    pending = pending.then(() => onBatch(batch));
  });
  await pipeline(createReadStream(pbfPath), parser);
  await pending;
}

async function main(): Promise<void> {
  const { pbf, outDir } = parseArgs();
  if (!existsSync(pbf)) {
    console.error(`Missing PBF: ${pbf}`);
    console.error("Run: bun run osrm:prepare");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "osm-addresses-vn.csv");
  const out = createWriteStream(outFile, { encoding: "utf8" });
  out.write("id,source,layer,name,housenumber,street,lat,lon\n");

  const wayAddrs: Array<{ id: number; tags: Record<string, string>; refs: number[] }> = [];
  const nodeAddrs: Array<{ id: number; tags: Record<string, string>; lat: number; lon: number }> =
    [];
  const wayNodeIds = new Set<number>();

  console.log("Pass 1: collect tagged address nodes and ways...");
  await streamPbf(pbf, (batch) => {
    for (const item of batch) {
      if (item.type === "node") {
        const hn = item.tags?.["addr:housenumber"];
        const street = item.tags?.["addr:street"];
        if (hn && street && isValidHouseNumber(hn)) {
          nodeAddrs.push({ id: item.id, tags: item.tags!, lat: item.lat, lon: item.lon });
        }
      } else if (item.type === "way") {
        const hn = item.tags?.["addr:housenumber"];
        const street = item.tags?.["addr:street"];
        if (hn && street && isValidHouseNumber(hn) && item.refs?.length) {
          wayAddrs.push({ id: item.id, tags: item.tags!, refs: item.refs });
          for (const ref of item.refs) wayNodeIds.add(ref);
        }
      }
    }
  });

  console.log(`  nodes: ${nodeAddrs.length}, ways: ${wayAddrs.length}`);

  const nodeCoords = new Map<number, [number, number]>();
  if (wayNodeIds.size > 0) {
    console.log("Pass 2: load way node coordinates...");
    await streamPbf(pbf, (batch) => {
      for (const item of batch) {
        if (item.type === "node" && wayNodeIds.has(item.id)) {
          nodeCoords.set(item.id, [item.lon, item.lat]);
        }
      }
    });
  }

  const rows: AddrRow[] = [];
  const dedupe = new Set<string>();

  const pushRow = (id: string, hn: string, street: string, lat: number, lon: number) => {
    const key = `${normalizeAdminText(hn)}|${normalizeAdminText(street)}|${lat.toFixed(5)}|${lon.toFixed(5)}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    const name = `${hn} ${street}`;
    rows.push({ id, name, housenumber: hn, street, lat, lon });
  };

  for (const n of nodeAddrs) {
    pushRow(
      `osm-node-${n.id}`,
      n.tags["addr:housenumber"]!.trim(),
      n.tags["addr:street"]!.trim(),
      n.lat,
      n.lon,
    );
  }

  for (const w of wayAddrs) {
    const coords = w.refs.map((ref) => nodeCoords.get(ref)).filter(Boolean) as [number, number][];
    if (coords.length === 0) continue;
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    pushRow(
      `osm-way-${w.id}`,
      w.tags["addr:housenumber"]!.trim(),
      w.tags["addr:street"]!.trim(),
      lat,
      lng,
    );
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  for (const r of rows) {
    out.write(
      [
        csvEscape(r.id),
        "osm-addr",
        "address",
        csvEscape(r.name),
        csvEscape(r.housenumber),
        csvEscape(r.street),
        r.lat.toFixed(6),
        r.lon.toFixed(6),
      ].join(",") + "\n",
    );
  }

  await new Promise<void>((resolve, reject) => {
    out.end(() => resolve());
    out.on("error", reject);
  });

  console.log(`Wrote ${rows.length.toLocaleString()} addresses → ${outFile}`);
  console.log("Server import: bun run pelias:import (or pelias import csv if index exists)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
