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
SCRIPT="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

# Pelias CLI refuses root — re-exec as `pelias` user on Linux servers.
if [ "$(id -u)" = "0" ] && [ -z "${PELIAS_AS_USER:-}" ]; then
  if ! id pelias >/dev/null 2>&1; then
    useradd -m -s /bin/bash pelias
  fi
  usermod -aG docker pelias 2>/dev/null || true
  mkdir -p "$ROOT/pelias" "$ROOT/.pelias-docker" "$ROOT/pelias/vietnam/data/elasticsearch"
  chown -R pelias:pelias "$ROOT/.pelias-docker" 2>/dev/null || true
  find "$ROOT/pelias" -path '*/data/elasticsearch' -prune -o -exec chown pelias:pelias {} + 2>/dev/null || true
  chown -R 1000:1000 "$ROOT/pelias/vietnam/data/elasticsearch"
  exec su - pelias -c "cd '$ROOT' && PELIAS_AS_USER=1 sh '$SCRIPT'"
fi

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
# PBF is bind-mounted via OSM_PBF in docker-compose (see pelias/vietnam/.env).
# Elasticsearch data dir must be uid 1000 (container user); root block above handles it.
if [ "$(stat -c '%u' data/elasticsearch 2>/dev/null || echo 0)" != "1000" ]; then
  echo "Elasticsearch data dir must be owned by uid 1000."
  echo "  sudo chown -R 1000:1000 $PROJECT/data/elasticsearch"
  exit 1
fi

PELIAS="$PELIAS_DOCKER/pelias"
chmod +x "$PELIAS" 2>/dev/null || true

echo "==> Pelias system check"
"$PELIAS" system check

echo "==> Pull images"
"$PELIAS" compose pull

echo "==> Elasticsearch"
"$PELIAS" elastic start
"$PELIAS" elastic wait
"$PELIAS" elastic create || true

echo "==> Download WOF admin data (OSM PBF bind-mounted from ./data)"
"$PELIAS" download wof

echo "==> Import WOF admin layers"
"$PELIAS" import wof

echo "==> Prepare placeholder (builds from WOF sqlite)"
"$PELIAS" prepare placeholder

echo "==> Import OSM (admin lookup attaches city/district to every record)"
"$PELIAS" import osm

echo "==> Street layer (road network polylines)"
"$PELIAS" prepare polylines
"$PELIAS" import polylines

if [ -n "$(find data/custom-addresses -name '*.csv' 2>/dev/null | head -1)" ]; then
  echo "==> Import custom CSV addresses"
  "$PELIAS" import csv
fi

echo "==> Optimize index (refresh + force merge)"
curl -s -XPOST "http://127.0.0.1:9200/pelias/_refresh" >/dev/null || true
curl -m 900 -s -XPOST "http://127.0.0.1:9200/pelias/_forcemerge?max_num_segments=1" >/dev/null || true

echo "==> Start Pelias API stack"
"$PELIAS" compose up
# placeholder/api cache sqlite + config at startup — bounce if they were already running.
docker restart pelias_placeholder pelias_api >/dev/null 2>&1 || true

echo ""
echo "Pelias ready at http://127.0.0.1:4000"
echo "Test: curl 'http://127.0.0.1:4000/v1/autocomplete?text=Bitexco&size=3'"
