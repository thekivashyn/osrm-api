#!/bin/sh
# Remove dev IP firewall rules and restore localhost-only docker ports.
set -e
cd "$(dirname "$0")/.."

STATE_FILE="/opt/routing-api/.dev-ip"
COMPOSE_FILE="docker-compose.yml"
PELIAS_COMPOSE="pelias/vietnam/docker-compose.yml"
COMPOSE_BAK="docker-compose.yml.localhost.bak"
DEV_IP=""
[ -f "$STATE_FILE" ] && DEV_IP=$(cat "$STATE_FILE")

echo "==> Remove UFW dev rules"
while ufw status numbered | grep -qE "5050|5051|4000"; do
  num=$(ufw status numbered | grep -E "5050|5051|4000" | head -1 | sed -n 's/^\[\([0-9]*\)\].*/\1/p')
  [ -n "$num" ] || break
  echo y | ufw delete "$num" >/dev/null 2>&1 || break
done

if [ -n "$DEV_IP" ]; then
  for port in 5050 5051 4000; do
    ufw delete allow from "$DEV_IP" to any port "$port" proto tcp 2>/dev/null || true
  done
  rm -f "$STATE_FILE"
fi

if [ -f "$COMPOSE_BAK" ]; then
  cp "$COMPOSE_BAK" "$COMPOSE_FILE"
else
  sed -i \
    -e 's|"5050:5000"|"127.0.0.1:5050:5000"|g' \
    -e 's|"5051:5001"|"127.0.0.1:5051:5001"|g' \
    "$COMPOSE_FILE"
fi

if [ -f "$PELIAS_COMPOSE" ]; then
  sed -i -e 's|"4000:4000"|"127.0.0.1:4000:4000"|g' "$PELIAS_COMPOSE"
fi

echo "==> Restore localhost-only docker ports"
docker compose up -d --force-recreate osrm || docker compose up -d osrm
if [ -f "$PELIAS_COMPOSE" ] && [ -d ".pelias-docker" ]; then
  sh scripts/pelias-up.sh 2>/dev/null || true
fi

echo "Dev external access revoked."
