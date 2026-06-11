#!/bin/sh
# Recreate Docker containers with localhost-only ports (after OSRM graphs are built).
set -e
cd "$(dirname "$0")/.."

if ! curl -sf "http://127.0.0.1:5050/route/v1/driving/106.66,10.76;106.70,10.77?overview=false" >/dev/null 2>&1; then
  echo "OSRM not ready yet. Wait for: docker logs osrm | tail"
  echo "Look for: OSRM car ready on port 5000"
  exit 1
fi

docker compose up -d --force-recreate
echo "Docker recreated: localhost ports, OSRM mmap, Nominatim Postgres tuning."
ss -tlnp | grep -E "5050|5051|4000|8080" || true
curl -sf "http://127.0.0.1:5050/route/v1/driving/106.66,10.76;106.70,10.77?overview=false" | head -c 80
echo ""
