# Deploy — Routing API (Mức B, internal-only)

Repo: https://github.com/thekivashyn/osrm-api

> **Mục đích:** Chỉ server/app nội bộ gọi API — **không** public cho internet.
> Thông tin nhạy cảm: không commit password / private key.

---

## Server

| Mục | Giá trị |
|-----|---------|
| Provider | Vultr |
| Region | Singapore |
| IP | `149.28.134.50` |
| Hostname | `routing-sgp-01` |
| SSH | `ssh root@149.28.134.50` |
| App path | `/opt/routing-api` |
| Domain | `osrm-routing.vuatho.com` |
| API (HTTP) | http://osrm-routing.vuatho.com/health |

### Stack (chỉ listen nội bộ / qua Nginx)

| Service | URL | Public? |
|---------|-----|---------|
| API | `127.0.0.1:8080` | Không |
| OSRM car / motor | `127.0.0.1:5050` / `5051` | Không |
| Nominatim | `127.0.0.1:9091` | Không |
| Nginx | `:80` → API | Chỉ IP được phép |

---

## DNS — Cloudflare **DNS only** (tắt Proxy)

Dùng domain cho tiện (`routing.internal.example.com`) nhưng **không bật Proxy** — latency thấp, IP thật tới Vultr.

| Field | Giá trị |
|-------|---------|
| Type | **A** |
| Name | `osrm-routing` |
| FQDN | `osrm-routing.vuatho.com` |
| Content | `149.28.134.50` |
| **Proxy status** | **DNS only** — icon **mây xám** (OFF), **không** cam |
| TTL | Auto |

**Vì sao tắt Proxy:**

- Không qua CDN/WAF Cloudflare → **nhanh hơn** cho server-to-server
- IP client = IP server gọi (dễ whitelist trên Vultr/Nginx)
- API internal không cần cache/bot protection của CF

**Sau khi DNS:**

```bash
# Trên server — sửa server_name
nano /etc/nginx/sites-available/routing-api
# server_name osrm-routing.vuatho.com;

nginx -t && systemctl reload nginx
```

**HTTPS** (sau khi DNS trỏ):

```bash
ssh root@149.28.134.50
cd /opt/routing-api && ./scripts/enable-https.sh
```

---

## Chặn public — chỉ internal gọi được

Làm **cả hai** lớp (khuyên dùng):

### 1) Vultr Firewall (network)

Vultr → Server → **Firewall** → rule **Inbound**:

| Protocol | Port | Source |
|----------|------|--------|
| TCP | 22 | IP văn phòng / VPN anh |
| TCP | 80 | IP server/app được phép (hoặc dải VPC) |
| TCP | 443 | (nếu bật HTTPS) cùng source |

**Không** mở 5050, 5051, 9091, 8080.

### 2) Nginx `allow` (application)

Sửa `/etc/nginx/sites-available/routing-api`:

```nginx
server {
    listen 80;
    server_name routing.yourdomain.com 149.28.134.50;

    # IP server/app được gọi API — thêm từng dòng
    allow 203.0.113.10;      # app server 1
    allow 203.0.113.11;      # app server 2
    allow 198.51.100.0/24;   # office / VPC (ví dụ)
    deny all;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

### 3) Playground `/` (tuỳ chọn)

Internal-only thường **tắt playground** hoặc chỉ `allow` IP dev:

```nginx
location = / {
    allow 198.51.100.0/24;
    deny all;
    proxy_pass http://127.0.0.1:8080;
}
```

Hoặc block hẳn — API path `/api/*` vẫn allow server.

---

## Client nội bộ gọi API

```bash
# Qua domain (DNS only, không proxy)
curl http://routing.yourdomain.com/health

curl -s -X POST http://routing.yourdomain.com/api/route \
  -H "Content-Type: application/json" \
  -d '{"from":{"lat":10.7635,"lng":106.644},"to":{"lat":10.795,"lng":106.731},"profile":"motorbike"}'
```

Trong app backend: set `ROUTING_API_URL=http://routing.yourdomain.com` (hoặc IP nếu không dùng DNS).

---

## Trạng thái setup

- [x] Docker, Bun, Nginx, UFW, API systemd
- [x] OSRM + Nominatim Docker (build/import — theo dõi log)
- [x] Nginx `osrm-routing.vuatho.com` + rate limit + keepalive
- [x] sysctl + systemd tuning
- [ ] DNS A `osrm-routing` → `149.28.134.50` (NXDOMAIN hiện tại)
- [ ] HTTPS (`./scripts/enable-https.sh`)
- [ ] Docker localhost ports (`./scripts/secure-docker-ports.sh` sau OSRM ready)
- [ ] OSRM graphs ready
- [ ] Nominatim import OK

---

## Lệnh vận hành

```bash
ssh root@149.28.134.50
systemctl status routing-api
journalctl -u routing-api -f
docker logs -f osrm
docker logs -f nominatim
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:9091/status
```

---

## Điền thêm

| Mục | Giá trị |
|-----|---------|
| Domain (DNS only) | |
| IP server/app được phép | |
| Email geocode | dev.tringuyen@gmail.com |
