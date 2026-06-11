#!/bin/sh
# Enable HTTPS on origin with Cloudflare Origin Certificate (Full Strict).
set -e
DOMAIN=osrm-routing.vuatho.com
CERT=/etc/ssl/cloudflare/osrm-routing.pem
KEY=/etc/ssl/cloudflare/osrm-routing.key

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "Missing origin cert. Create in Cloudflare → SSL → Origin Server, then:"
  echo "  mkdir -p /etc/ssl/cloudflare"
  echo "  nano $CERT"
  echo "  nano $KEY"
  exit 1
fi

cat > /etc/nginx/sites-available/routing-api << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate $CERT;
    ssl_certificate_key $KEY;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 1m;

    location /api/geocode {
        limit_req zone=routing_geocode burst=16 nodelay;
        proxy_pass http://routing_api;
        include /etc/nginx/snippets/routing-proxy.conf;
        add_header Cache-Control "no-store" always;
    }

    location /api/ {
        limit_req zone=routing_api burst=80 nodelay;
        proxy_pass http://routing_api;
        include /etc/nginx/snippets/routing-proxy.conf;
        add_header Cache-Control "no-store" always;
    }

    location /health {
        access_log off;
        proxy_pass http://routing_api;
        include /etc/nginx/snippets/routing-proxy.conf;
    }

    location / {
        proxy_pass http://routing_api;
        include /etc/nginx/snippets/routing-proxy.conf;
        add_header Cache-Control "no-store" always;
    }
}
EOF

nginx -t && systemctl reload nginx
echo "Origin HTTPS ready. Set Cloudflare SSL mode to Full (Strict)."
