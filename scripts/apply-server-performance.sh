#!/bin/sh
# Apply nginx + sysctl + docker localhost bind. Pelias managed separately (pelias/vietnam).
set -e

APP_DIR="${APP_DIR:-/opt/routing-api}"
cd "$APP_DIR"

cp deploy/sysctl-routing.conf /etc/sysctl.d/99-routing-api.conf
sysctl --system >/dev/null 2>&1 || sysctl -p /etc/sysctl.d/99-routing-api.conf

cp deploy/nginx-osrm-routing-cloudflare.conf /etc/nginx/sites-available/routing-api
ln -sf /etc/nginx/sites-available/routing-api /etc/nginx/sites-enabled/routing-api
nginx -t && systemctl reload nginx

cp deploy/routing-api.service /etc/systemd/system/routing-api.service
systemctl daemon-reload
systemctl restart routing-api

echo "==> docker compose (OSRM)"
docker compose up -d --force-recreate osrm

echo "==> Pelias (if imported)"
if [ -d "$APP_DIR/.pelias-docker" ] && curl -sf "http://127.0.0.1:4000/v1/autocomplete?text=test&size=1&boundary.country=VNM" >/dev/null 2>&1; then
  sh "$APP_DIR/scripts/pelias-up.sh"
else
  echo "Pelias not ready — run: bun run pelias:import && bun run pelias:up"
fi

ss -tlnp | grep -E '5050|5051|4000|8080' || true
