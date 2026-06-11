#!/bin/sh
# Allow one dev IP to reach OSRM/Nominatim ports (UFW + public docker bind).
# Usage: ./scripts/allow-dev-ip.sh 171.249.155.228
# Revoke: ./scripts/revoke-dev-ip.sh
set -e
cd "$(dirname "$0")/.."

DEV_IP="${1:?Usage: $0 <dev-ip>}"
PORTS="5050 5051 9091"
STATE_FILE="/opt/routing-api/.dev-ip"
COMPOSE_FILE="docker-compose.yml"
COMPOSE_BAK="docker-compose.yml.localhost.bak"

echo "==> UFW allow $DEV_IP -> ports $PORTS"
for port in $PORTS; do
  ufw allow from "$DEV_IP" to any port "$port" proto tcp comment "routing-api dev" 2>/dev/null || \
    ufw allow from "$DEV_IP" to any port "$port" proto tcp
done

echo "$DEV_IP" > "$STATE_FILE"

if [ ! -f "$COMPOSE_BAK" ]; then
  cp "$COMPOSE_FILE" "$COMPOSE_BAK"
fi
sed -i \
  -e 's|127.0.0.1:5050:5000|5050:5000|g' \
  -e 's|127.0.0.1:5051:5001|5051:5001|g' \
  -e 's|127.0.0.1:9091:8080|9091:8080|g' \
  "$COMPOSE_FILE"

echo "==> Docker recreate (0.0.0.0 bind, UFW restricts to $DEV_IP)"
if curl -sf http://127.0.0.1:9091/status 2>/dev/null | grep -q OK; then
  docker compose up -d --force-recreate
else
  echo "Nominatim still importing — recreating osrm only"
  docker compose up -d --force-recreate osrm || docker compose up -d osrm
  echo "When GEO ready, re-run: $0 $DEV_IP"
fi

echo ""
echo "Local Mac: bun run dev:remote"
echo "  OSRM_URL=http://149.28.134.50:5050"
echo ""
ss -tlnp | grep -E "5050|5051|9091" || true
