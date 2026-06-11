#!/bin/sh
# Extract addr:housenumber tags from vietnam-latest.osm.pbf → Pelias CSV.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBF="${PBF_FILE:-$ROOT/data/vietnam-latest.osm.pbf}"
OUT="${ADDRESSES_OUT_DIR:-$ROOT/data/custom-addresses}"

if [ ! -f "$PBF" ]; then
  echo "Missing map data: $PBF"
  echo "Run: bun run osrm:prepare"
  exit 1
fi

echo "Extracting OSM street addresses..."
echo "  PBF: $PBF"
echo "  Out: $OUT"
echo ""

exec bun "$ROOT/scripts/extract-osm-addresses.ts" --pbf "$PBF" --out "$OUT"
