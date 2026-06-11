#!/bin/sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBF="${ROOT}/data/vietnam-latest.osm.pbf"

if [ ! -f "$PBF" ]; then
  echo "Missing map data. Run: bun run osrm:prepare"
  exit 1
fi

echo "Starting OSRM (:5050) + Nominatim (:9091)..."
echo "  OSRM data:      ./data (shared vietnam-latest.osm.pbf)"
echo "  Nominatim DB:   docker volume nominatim-db (first import: 1-4+ hours)"
echo ""

docker compose up osrm nominatim -d

echo ""
echo "Follow logs:"
echo "  bun run osrm:logs"
echo "  bun run nominatim:logs"
echo ""
echo "When Nominatim is ready (status OK):"
echo "  curl http://localhost:9091/status"
echo "  curl \"http://localhost:8080/api/geocode?q=Bitexco\""
