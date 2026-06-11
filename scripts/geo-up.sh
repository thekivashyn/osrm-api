#!/bin/sh
# Production server: OSRM + Pelias. Local dev: chỉ `bun run osrm:up` (Pelias trên server).
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBF="${ROOT}/data/vietnam-latest.osm.pbf"

if [ "$(uname -s)" = "Darwin" ] && [ "${GEO_UP_SERVER:-}" != "1" ]; then
  echo "geo:up là stack production (OSRM + Pelias trên server)."
  echo "  Local dev:  bun run osrm:up"
  echo "  Geocode:    PELIAS_URL trỏ server (xem .env.development)"
  exit 1
fi

if [ ! -f "$PBF" ]; then
  echo "Missing map data. Run: bun run osrm:prepare"
  exit 1
fi

if [ ! -f "$ROOT/data/buildings/manifest.json" ]; then
  echo "Building index not built yet. After OSRM is up, run:"
  echo "  bun run buildings:extract   # one-time from vietnam-latest.osm.pbf"
fi

echo "Starting OSRM (:5050/:5051) + Pelias (:4000)..."
echo "  OSRM PBF:   ./data/vietnam-latest.osm.pbf"
echo "  Pelias:     pelias/vietnam (first import: bun run pelias:import)"
echo ""

docker compose up osrm -d

if [ -d "$ROOT/.pelias-docker" ] && [ -d "$ROOT/pelias/vietnam/data/elasticsearch" ]; then
  sh "$ROOT/scripts/pelias-up.sh"
else
  echo "Pelias not imported yet. After OSRM is up, run:"
  echo "  bun run pelias:import   # one-time index build"
  echo "  bun run pelias:up       # start API only"
fi

echo ""
echo "  bun run osrm:logs"
echo "  bun run pelias:logs"
