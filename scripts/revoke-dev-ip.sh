#!/bin/sh
# Remove dev IP firewall rules and restore localhost-only docker ports.
set -e
cd "$(dirname "$0")/.."

STATE_FILE="/opt/routing-api/.dev-ip"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_BAK="docker-compose.yml.localhost.bak"
DEV_IP=""
[ -f "$STATE_FILE" ] && DEV_IP=$(cat "$STATE_FILE")

echo "==> Remove UFW dev rules"
while ufw status numbered | grep -qE "5050|5051|9091"; do
  num=$(ufw status numbered | grep -E "5050|5051|9091" | head -1 | sed -n 's/^\[\([0-9]*\)\].*/\1/p')
  [ -n "$num" ] || break
  echo y | ufw delete "$num" >/dev/null 2>&1 || break
done

if [ -n "$DEV_IP" ]; then
  for port in 5050 5051 9091; do
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
    -e 's|"9091:8080"|"127.0.0.1:9091:8080"|g' \
    "$COMPOSE_FILE"
fi

echo "==> Restore localhost-only docker ports"
if curl -sf http://127.0.0.1:9091/status 2>/dev/null | grep -q OK; then
  docker compose up -d --force-recreate
else
  docker compose up -d --force-recreate osrm || docker compose up -d osrm
fi

echo "Dev external access revoked."
