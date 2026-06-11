# Cloudflare — osrm-routing.vuatho.com (proxy ON)

## SSL mode (Cloudflare dashboard → SSL/TLS)

| Mode | Origin cần gì | Khuyên |
|------|----------------|--------|
| **Flexible** | Chỉ HTTP :80 | OK nhanh, kém bảo mật leg CF→origin |
| **Full** | HTTPS origin (cert bất kỳ / self-signed) | Tốt hơn |
| **Full (Strict)** | Origin cert hợp lệ | **Khuyên prod** — dùng Cloudflare Origin Certificate |

Với **proxy ON + SSL ở CF**, **không cần certbot** trên Vultr nếu dùng **Flexible** hoặc **Full + Origin Cert**.

### Origin Certificate (Full Strict — khuyên dùng)

1. Cloudflare → SSL/TLS → **Origin Server** → Create Certificate  
2. Hostnames: `osrm-routing.vuatho.com`  
3. Copy cert + key lên server:
   - `/etc/ssl/cloudflare/osrm-routing.pem`
   - `/etc/ssl/cloudflare/osrm-routing.key`
4. Chạy: `./scripts/enable-cloudflare-origin-ssl.sh`

---

## Cache — QUAN TRỌNG cho API

POST `/api/route` **không được cache**. Cấu hình trên Cloudflare:

**Cache Rules** (hoặc Page Rules):

| Rule | Match | Setting |
|------|-------|---------|
| Bypass API | `osrm-routing.vuatho.com/api/*` | Cache Level: **Bypass** |
| Bypass geocode | `osrm-routing.vuatho.com/api/geocode*` | Bypass |

Hoặc **Configuration → Cache → Cache Rules → Bypass cache** cho path `/api/*`.

Playground `/` có thể cache ngắn — không bắt buộc.

---

## Security (tuỳ chọn)

- **WAF** → rate limit bot nếu API lộ public  
- **Firewall Rules** → chỉ cho phép country VN + server IP internal (nếu biết IP app)  
- Vultr firewall: vẫn có thể giới hạn 80/443 chỉ từ [Cloudflare IP ranges](https://www.cloudflare.com/ips/) — chặn bypass trực tiếp IP `149.28.134.50`

---

## Nginx trên origin (đã apply)

- `cloudflare-realip.conf` — log + rate limit theo IP client thật (`CF-Connecting-IP`)  
- `Cache-Control: no-store` trên `/api/*`  
- Origin HTTP :80 — phù hợp **Flexible** hoặc CF → HTTP

---

## Kiểm tra

```bash
curl -s https://osrm-routing.vuatho.com/health
curl -s https://osrm-routing.vuatho.com/api/osrm-status
curl -s https://osrm-routing.vuatho.com/api/geocode-status
```

OSRM/GEO pill đỏ = backend đang build, không phải lỗi Cloudflare.

Track build: `ssh root@149.28.134.50 '/opt/routing-api/scripts/status.sh --watch'`
