#!/bin/sh
# Apply nginx config for Cloudflare proxied SSL (no certbot).
set -e
DOMAIN=osrm-routing.vuatho.com
APP_DIR="${APP_DIR:-/opt/routing-api}"

cp "$APP_DIR/deploy/nginx-cloudflare-realip.conf" /etc/nginx/conf.d/cloudflare-realip.conf
cp "$APP_DIR/deploy/nginx-osrm-routing-cloudflare.conf" /etc/nginx/sites-available/routing-api
ln -sf /etc/nginx/sites-available/routing-api /etc/nginx/sites-enabled/routing-api
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "Cloudflare origin nginx applied for $DOMAIN (HTTP :80, real IP from CF)."
echo "Set Cloudflare SSL mode: Flexible (now) or Full Strict + origin cert (recommended)."
echo "Bypass cache for /api/* in Cloudflare dashboard — see deploy/CLOUDFLARE.md"
