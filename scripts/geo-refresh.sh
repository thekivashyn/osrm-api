#!/bin/sh
# Monthly data refresh — **production server only**.
# Latest Geofabrik Vietnam PBF → OSRM graphs rebuild + Pelias re-import.
# Cron: /etc/cron.d/geo-refresh (03:00 +07, mùng 1 hằng tháng).
set -e

if [ "$(uname -s)" = "Darwin" ] && [ "${GEO_REFRESH_LOCAL:-}" != "1" ]; then
  echo "geo-refresh chạy trên server (cron). Local dev không cần."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PELIAS="$ROOT/.pelias-docker/pelias"

echo "==> [$(date -Is)] Download latest Vietnam PBF"
sh "$ROOT/scripts/update-osrm-map.sh"

echo "==> Rebuild OSRM graphs (routes degraded during rebuild)"
cd "$ROOT"
docker compose stop osrm
docker compose rm -f osrm
docker compose up osrm -d

if [ ! -x "$PELIAS" ]; then
  echo "Pelias not installed — skipping geocoder refresh."
  exit 0
fi

echo "==> Pelias re-import (addresses/venues/streets from new PBF)"
su - pelias -c "cd '$ROOT/pelias/vietnam' && '$PELIAS' import osm"
su - pelias -c "cd '$ROOT/pelias/vietnam' && '$PELIAS' prepare polylines && '$PELIAS' import polylines"
su - pelias -c "cd '$ROOT/pelias/vietnam' && '$PELIAS' prepare interpolation"
docker restart pelias_interpolation >/dev/null 2>&1 || true

echo "==> Overture Places refresh (POI + crowd-sourced alley addresses)"
sh "$ROOT/scripts/overture-places.sh" || echo "Overture refresh failed — keeping previous data."

echo "==> Optimize index"
curl -s -XPOST "http://127.0.0.1:9200/pelias/_refresh" >/dev/null || true
curl -m 900 -s -XPOST "http://127.0.0.1:9200/pelias/_forcemerge?max_num_segments=1" >/dev/null || true

echo "==> [$(date -Is)] Refresh done"
