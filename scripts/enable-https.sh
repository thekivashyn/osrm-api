#!/bin/sh
# Run on server after DNS A record points to this machine.
set -e
DOMAIN=osrm-routing.vuatho.com
IP=$(curl -s ifconfig.me || curl -s icanhazip.com)
RESOLVED=$(getent hosts "$DOMAIN" | awk "{print \$1}" | head -1)

if [ "$RESOLVED" != "$IP" ] && [ "$RESOLVED" != "149.28.134.50" ]; then
  echo "DNS not ready: $DOMAIN -> ${RESOLVED:-none} (expected $IP)"
  exit 1
fi

certbot --nginx -d "$DOMAIN" \
  --non-interactive --agree-tos -m dev.tringuyen@gmail.com --redirect

echo "HTTPS ready: https://$DOMAIN/health"
