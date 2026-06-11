#!/bin/sh
# Allow one dev IP to reach OSRM/Pelias ports (UFW + public docker bind).
# Usage: ./scripts/allow-dev-ip.sh 171.249.155.228
# Revoke: ./scripts/revoke-dev-ip.sh
set -e
cd "$(dirname "$0")/.."

DEV_IP="${1:?Usage: $0 <dev-ip>}"
PORTS="5050 5051 4000"
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
  "$COMPOSE_FILE"
if [ -f pelias/vietnam/docker-compose.yml ]; then
  sed -i -e 's|127.0.0.1:4000:4000|4000:4000|g' pelias/vietnam/docker-compose.yml
fi

echo "==> Docker recreate (0.0.0.0 bind, UFW restricts to $DEV_IP)"
docker compose up -d --force-recreate osrm || docker compose up -d osrm
if curl -sf "http://127.0.0.1:4000/v1/autocomplete?text=Bitexco&size=1" 2>/dev/null | grep -q FeatureCollection; then
  (cd pelias/vietnam && docker compose up -d --force-recreate api)
else
  echo "Pelias not ready — when imported, re-run: $0 $DEV_IP"
fi

echo ""
echo "Local Mac: bun run dev:remote"
echo "  OSRM_URL=http://149.28.134.50:5050"
echo ""
ss -tlnp | grep -E "5050|5051|4000" || true
