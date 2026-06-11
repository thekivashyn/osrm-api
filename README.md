# Routing API

Internal REST API for road routing, distance matrices, map matching, and trip optimization — powered by [OSRM](http://project-osrm.org/) and built with **Bun** + **Elysia**.

Designed for internal use (similar to Google Directions / Grab routing backends).

## Architecture

```
Client → Routing API (:8080, Bun) → OSRM (:5050) + Nominatim (:9091) — both Docker, Vietnam PBF
```

| Layer | Role |
|-------|------|
| **Routing API** | Validation, logging, error handling, REST contract |
| **OSRM** | Shortest path, table, nearest, match, trip on OpenStreetMap |
| **OpenStreetMap** | Vietnam extract (Geofabrik) |

### Folder structure

```
.
├── server.ts                 # Application entry
├── src/
│   ├── config/               # Environment (PORT, OSRM_URL)
│   ├── controllers/          # HTTP handlers
│   ├── services/             # OSRM client (route, table, nearest, match, trip)
│   ├── routes/               # Elysia route definitions + /docs
│   ├── types/                # Shared TypeScript types
│   ├── utils/                # Validation, response helpers
│   └── middlewares/          # Logger, error handler
├── docker/
│   └── osrm-entrypoint.sh    # OSRM extract → partition → customize → routed
├── docker-compose.yml        # OSRM + Routing API
└── Dockerfile                # Routing API image
```

## Prerequisites

- [Bun](https://bun.sh) 1.1+
- OSRM running (local or via Docker Compose)

> **macOS note:** Port `7000` is often taken by AirPlay Receiver. Port **`5000`** is also used by AirPlay on many Macs. This project uses **`8080`** (API) and **`5050`** (OSRM).

## Install

```bash
bun install
cp .env.example .env
```

## Run (development)

```bash
bun run dev
```

Server: **http://localhost:8080**

Open in browser for interactive API playground (Route, Table, Nearest, Match, Trip).

## Run (production)

```bash
bun run start
```

## Dev workflow (recommended)

**Local dev — OSRM only, geocoding via public OpenStreetMap:**

```bash
# One-time: download Vietnam map (~309MB)
bun run osrm:prepare

# Start OSRM (routing)
bun run osrm:up

# API + playground — uses .env.development → nominatim.openstreetmap.org
bun run dev            # http://localhost:8080
```

No Nominatim Docker needed for dev. `bun run dev` sets `NODE_ENV=development` and loads `.env.development` (public geocoding, ~1 req/s limit — fine for playground).

**Production / self-hosted geocoding:**

```bash
bun run geo:up         # OSRM + Nominatim
bun run nominatim:logs # first import: 1–4+ hours
curl http://localhost:9091/status   # wait until "OK"

cp .env.example .env   # NOMINATIM_URL=http://localhost:9091
bun run start
```

| Service | Port | Dev | Production |
|---------|------|-----|------------|
| OSRM | 5050 | `bun run osrm:up` | Docker |
| Geocoding | — | public OSM (`.env.development`) | Nominatim `:9091` |
| API | 8080 | `bun run dev` | `bun run start` |

Shared map file: `./data/vietnam-latest.osm.pbf` (OSRM; Nominatim when self-hosted).

## Docker (OSRM + Nominatim)

```bash
chmod +x docker/osrm-entrypoint.sh scripts/geo-up.sh
bun run geo:up
```

- OSRM: http://localhost:5050  
- Nominatim: http://localhost:9091  
- Routing API: `bun run dev` → http://localhost:8080  

**Resources (Vietnam extract):** ~8GB RAM recommended, `shm_size: 2gb` for Nominatim Postgres, ~10GB+ disk for Nominatim DB volume.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | API listen port |
| `OSRM_URL` | `http://localhost:5050` | OSRM base URL |
| `NOMINATIM_URL` | `http://localhost:9091` | Nominatim base URL (prod). Dev uses `.env.development` → public OSM |
| `GEOCODE_USER_AGENT` | `routing-api-internal/1.0` | Required User-Agent for geocode requests (include contact email in prod) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Browser playground — test all endpoints |
| GET | `/api/geocode?q=...` | Address search (self-hosted Nominatim) |
| GET | `/api/geocode-status` | Nominatim health |
| GET | `/health` | Health check |
| GET | `/docs` | HTML API documentation |
| POST | `/api/route` | Point-to-point route |
| POST | `/api/table` | Distance/duration matrix |
| POST | `/api/nearest` | Snap to nearest road |
| POST | `/api/match` | Map-match GPS trace |
| POST | `/api/trip` | Optimized multi-stop trip |

## Example: Route (Ho Chi Minh City)

```bash
curl -s -X POST http://localhost:8080/api/route \
  -H "Content-Type: application/json" \
  -d '{
    "from": { "lat": 10.762622, "lng": 106.660172 },
    "to":   { "lat": 10.776889, "lng": 106.700806 }
  }' | jq
```

### Sample success response

```json
{
  "success": true,
  "data": {
    "distance": 5234.5,
    "duration": 612.3,
    "geometry": { "type": "LineString", "coordinates": [[106.66, 10.76], "..."] },
    "legs": [],
    "weight": 612.3,
    "summary": "Đường Nguyễn Huệ → ..."
  }
}
```

### Health check

```bash
curl -s http://localhost:8080/health | jq
```

```json
{
  "success": true,
  "service": "routing-api",
  "status": "ok"
}
```

## Error format

```json
{
  "success": false,
  "message": "Invalid from.lat: must be a number between -90 and 90"
}
```

## Extensibility

The codebase is structured to add later:

- Pelias geocoding
- Reverse geocoding
- Traffic overlays
- ETA models
- Pricing engine
- Driver tracking
- Redis caching

## License

Internal use only.
