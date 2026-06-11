#!/bin/sh
# Build offline building footprint index from vietnam-latest.osm.pbf (same file as OSRM).
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBF="${PBF_FILE:-$ROOT/data/vietnam-latest.osm.pbf}"
OUT="${BUILDINGS_DATA_DIR:-$ROOT/data/buildings}"

if [ ! -f "$PBF" ]; then
  echo "Missing map data: $PBF"
  echo "Run: bun run osrm:prepare"
  exit 1
fi

echo "Building footprint index from local OSM extract..."
echo "  PBF:  $PBF"
echo "  Out:  $OUT"
echo ""

exec bun "$ROOT/scripts/build-building-index.ts" --pbf "$PBF" --out "$OUT"
