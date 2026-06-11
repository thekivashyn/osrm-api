#!/bin/sh
# Apply performance + security tuning on production server (run as root).
# Safe during Nominatim import: skips nominatim recreate until GEO is ready.
set -e
cd "$(dirname "$0")/.."
APP_DIR="${APP_DIR:-/opt/routing-api}"

echo "==> sysctl"
cp deploy/sysctl-routing.conf /etc/sysctl.d/99-routing-api.conf
sysctl --system >/dev/null 2>&1 || sysctl -p /etc/sysctl.d/99-routing-api.conf

echo "==> nginx global (worker_connections, multi_accept)"
NGINX_CONF=/etc/nginx/nginx.conf
if grep -q 'worker_connections 768' "$NGINX_CONF" 2>/dev/null; then
  sed -i 's/worker_connections 768/worker_connections 4096/' "$NGINX_CONF"
fi
if ! grep -q 'multi_accept on' "$NGINX_CONF" 2>/dev/null; then
  sed -i '/worker_connections/a\        multi_accept on;' "$NGINX_CONF"
fi

echo "==> nginx conf.d + site + snippet"
cp deploy/nginx-cloudflare-realip.conf /etc/nginx/conf.d/cloudflare-realip.conf
cp deploy/routing-performance.conf /etc/nginx/conf.d/routing-performance.conf
cp deploy/nginx-gzip-api.conf /etc/nginx/conf.d/nginx-gzip-api.conf
cp deploy/nginx-snippet-proxy.conf /etc/nginx/snippets/routing-proxy.conf
cp deploy/nginx-osrm-routing-cloudflare.conf /etc/nginx/sites-available/routing-api
ln -sf /etc/nginx/sites-available/routing-api /etc/nginx/sites-enabled/routing-api
nginx -t
systemctl reload nginx

echo "==> .env production tuning"
ENV_FILE="$APP_DIR/.env"
touch "$ENV_FILE"
grep -q '^HOST=' "$ENV_FILE" || echo 'HOST=127.0.0.1' >> "$ENV_FILE"
sed -i 's/^GEOCODE_CACHE_TTL_MS=.*/GEOCODE_CACHE_TTL_MS=900000/' "$ENV_FILE" 2>/dev/null || \
  echo 'GEOCODE_CACHE_TTL_MS=900000' >> "$ENV_FILE"
sed -i 's/^ROUTE_CACHE_TTL_MS=.*/ROUTE_CACHE_TTL_MS=1800000/' "$ENV_FILE" 2>/dev/null || \
  echo 'ROUTE_CACHE_TTL_MS=1800000' >> "$ENV_FILE"

echo "==> systemd routing-api (localhost bind)"
cp deploy/routing-api.service /etc/systemd/system/routing-api.service
systemctl daemon-reload
systemctl restart routing-api
sleep 1
curl -sf http://127.0.0.1:8080/health >/dev/null || { echo "API health failed"; exit 1; }

echo "==> docker compose (osrm always; nominatim only when ready)"
cd "$APP_DIR"
docker compose up -d osrm

if curl -sf http://127.0.0.1:9091/status 2>/dev/null | grep -q OK; then
  echo "Nominatim ready — recreating with Postgres tuning + localhost ports"
  docker compose up -d --force-recreate nominatim
else
  echo "Nominatim still importing — skipping nominatim recreate (Postgres env applies on next recreate)"
fi

if curl -sf "http://127.0.0.1:5050/route/v1/driving/106.66,10.76;106.70,10.77?overview=false" >/dev/null 2>&1; then
  echo "OSRM ready — recreating containers for mmap + localhost ports"
  docker compose up -d --force-recreate
else
  echo "OSRM still building — skipping osrm restart (avoids interrupting graph build)"
  echo "After OSRM ready: cd $APP_DIR && ./scripts/secure-docker-ports.sh"
fi

echo ""
echo "Done. Verify:"
ss -tlnp | grep -E '5050|5051|9091|8080' || true
curl -s http://127.0.0.1/health
echo ""
"$APP_DIR/scripts/status.sh" 2>/dev/null || true
