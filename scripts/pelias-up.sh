#!/bin/sh
# Start Pelias runtime — **production server only**.
set -e

if [ "$(uname -s)" = "Darwin" ] && [ "${PELIAS_ALLOW_LOCAL:-}" != "1" ]; then
  echo "Pelias chạy trên server. Local dev dùng PELIAS_URL remote trong .env.development"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/pelias/vietnam"
PELIAS_DOCKER="$ROOT/.pelias-docker"

if [ ! -d "$PELIAS_DOCKER" ]; then
  echo "Pelias CLI missing. Run: bun run pelias:import"
  exit 1
fi

cd "$PROJECT"
[ -f .env ] || cp .env.example .env

"$PELIAS_DOCKER/pelias" elastic start
"$PELIAS_DOCKER/pelias" elastic wait
"$PELIAS_DOCKER/pelias" compose up

echo "Pelias API → http://127.0.0.1:4000"
