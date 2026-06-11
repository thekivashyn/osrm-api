#!/bin/sh
# Start Pelias runtime — **production server only**.
set -e

if [ "$(uname -s)" = "Darwin" ] && [ "${PELIAS_ALLOW_LOCAL:-}" != "1" ]; then
  echo "Pelias chạy trên server. Local dev dùng PELIAS_URL remote trong .env.development"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

if [ "$(id -u)" = "0" ] && [ -z "${PELIAS_AS_USER:-}" ]; then
  if ! id pelias >/dev/null 2>&1; then
    useradd -m -s /bin/bash pelias
  fi
  usermod -aG docker pelias 2>/dev/null || true
  chown -R pelias:pelias "$ROOT/pelias" "$ROOT/.pelias-docker" 2>/dev/null || true
  exec su - pelias -c "cd '$ROOT' && PELIAS_AS_USER=1 sh '$SCRIPT'"
fi

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
