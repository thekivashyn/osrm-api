#!/bin/sh
# Bootstrap Pelias Vietnam index — **production server only** (not local Mac dev).
set -e

if [ "$(uname -s)" = "Darwin" ] && [ "${PELIAS_ALLOW_LOCAL:-}" != "1" ]; then
  echo "Pelias chạy trên server, không import trên Mac dev."
  echo "  SSH server → cd /opt/routing-api → bun run pelias:import"
  echo "  Local dev: .env.development trỏ PELIAS_URL tới server."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/pelias/vietnam"
PELIAS_DOCKER="$ROOT/.pelias-docker"
PBF="$ROOT/data/vietnam-latest.osm.pbf"

if [ ! -f "$PBF" ]; then
  echo "Missing map data. Run: bun run osrm:prepare"
  exit 1
fi

if [ ! -d "$PELIAS_DOCKER" ]; then
  echo "Cloning pelias/docker (CLI helper)..."
  git clone --depth 1 https://github.com/pelias/docker.git "$PELIAS_DOCKER"
fi

cd "$PROJECT"

if [ ! -f .env ]; then
  cp .env.example .env
fi

mkdir -p data/openstreetmap data/custom-addresses
ln -sf "$PBF" data/openstreetmap/vietnam-latest.osm.pbf

PELIAS="$PELIAS_DOCKER/pelias"
chmod +x "$PELIAS" 2>/dev/null || true

echo "==> Pelias system check"
"$PELIAS" system check

echo "==> Pull images"
"$PELIAS" compose pull

echo "==> Elasticsearch"
"$PELIAS" elastic start
"$PELIAS" elastic wait
"$PELIAS" elastic create

echo "==> Download WOF + Geonames (OSM PBF symlinked from ./data)"
"$PELIAS" download wof
"$PELIAS" download geonames 2>/dev/null || true

echo "==> Prepare placeholder"
"$PELIAS" prepare placeholder

echo "==> Import WOF + OSM"
"$PELIAS" import wof
"$PELIAS" import osm

if [ -n "$(find data/custom-addresses -name '*.csv' 2>/dev/null | head -1)" ]; then
  echo "==> Import custom CSV addresses"
  "$PELIAS" import csv
fi

echo "==> Start Pelias API stack"
"$PELIAS" compose up

echo ""
echo "Pelias ready at http://127.0.0.1:4000"
echo "Test: curl 'http://127.0.0.1:4000/v1/autocomplete?text=Bitexco&boundary.country=VNM&size=3'"
