#!/bin/sh
# Allow one dev IP to reach OSRM/Nominatim ports (UFW + docker overlay).
# Usage: ./scripts/allow-dev-ip.sh 171.249.155.228
# Revoke: ./scripts/revoke-dev-ip.sh
set -e
cd "$(dirname "$0")/.."

DEV_IP="${1:?Usage: $0 <dev-ip>}"
PORTS="5050 5051 9091"
STATE_FILE="/opt/routing-api/.dev-ip"

echo "==> UFW allow $DEV_IP -> ports $PORTS"
for port in $PORTS; do
  ufw allow from "$DEV_IP" to any port "$port" proto tcp comment "routing-api dev" 2>/dev/null || \
    ufw allow from "$DEV_IP" to any port "$port" proto tcp
done
ufw status numbered | grep -E "5050|5051|9091" || true

echo "$DEV_IP" > "$STATE_FILE"

echo "==> Docker with dev-access overlay (ports on 0.0.0.0, protected by UFW)"
if curl -sf http://127.0.0.1:9091/status 2>/dev/null | grep -q OK; then
  docker compose -f docker-compose.yml -f deploy/docker-compose.dev-access.yml up -d --force-recreate
else
  echo "Nominatim still importing — recreating osrm only (keeps nominatim import running)"
  docker compose -f docker-compose.yml -f deploy/docker-compose.dev-access.yml up -d --force-recreate osrm
  echo "When GEO ready, re-run: $0 $DEV_IP"
fi

echo ""
echo "Dev machine .env:"
echo "  OSRM_URL=http://149.28.134.50:5050"
echo "  OSRM_MOTOR_URL=http://149.28.134.50:5051"
echo "  NOMINATIM_URL=http://149.28.134.50:9091"
echo ""
ss -tlnp | grep -E "5050|5051|9091" || true
