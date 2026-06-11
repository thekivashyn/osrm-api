import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  fetchBuildingFootprints,
  resetBuildingServiceState,
} from "../src/services/building.service";
import { resetBuildingStoreCache } from "../src/services/building-local.store";
import type { BuildingManifest } from "../src/services/building.types";

function writeTestIndex(base: string): void {
  const manifest: BuildingManifest = {
    version: 1,
    cellDeg: 0.005,
    sourcePbf: "test.osm.pbf",
    sourceMtimeMs: 1,
    featureCount: 1,
    tileCount: 1,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(join(base, "manifest.json"), JSON.stringify(manifest));

  const feature = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { id: 42, building: "house" },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [106.642, 10.761],
              [106.6421, 10.7611],
              [106.642, 10.7612],
              [106.642, 10.761],
            ],
          ],
        },
      },
    ],
  };
  const iy = Math.floor(10.761 / 0.005);
  const ix = Math.floor(106.642 / 0.005);
  const dir = join(base, "tiles", String(iy));
  mkdirSync(dir, { recursive: true });
  const gz = Bun.gzipSync(JSON.stringify(feature));
  writeFileSync(join(dir, `${ix}.json.gz`), gz);
}

describe("fetchBuildingFootprints (local index)", () => {
  let dataDir: string;
  const prev = process.env.BUILDINGS_DATA_DIR;

  beforeEach(() => {
    dataDir = join(tmpdir(), `buildings-test-${Date.now()}-${Math.random()}`);
    mkdirSync(dataDir, { recursive: true });
    writeTestIndex(dataDir);
    process.env.BUILDINGS_DATA_DIR = dataDir;
    resetBuildingStoreCache();
    resetBuildingServiceState();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.BUILDINGS_DATA_DIR;
    else process.env.BUILDINGS_DATA_DIR = prev;
    resetBuildingStoreCache();
    resetBuildingServiceState();
    rmSync(dataDir, { recursive: true, force: true });
  });

  test("returns GeoJSON from local tile index", async () => {
    const fc = await fetchBuildingFootprints(10.76, 106.64, 10.762, 106.645);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry.type).toBe("Polygon");
    expect(fc.features[0]?.properties.building).toBe("house");
  });

  test("clamps oversized bbox to center tile instead of rejecting", async () => {
    const fc = await fetchBuildingFootprints(10, 106, 10.02, 106.015);
    expect(fc.type).toBe("FeatureCollection");
    // Clamped bbox may still miss the test feature — should not throw
    expect(Array.isArray(fc.features)).toBe(true);
  });

  test("returns empty when index is missing", async () => {
    rmSync(dataDir, { recursive: true, force: true });
    resetBuildingStoreCache();
    resetBuildingServiceState();
    const fc = await fetchBuildingFootprints(10.76, 106.64, 10.762, 106.645);
    expect(fc.features).toHaveLength(0);
  });
});
