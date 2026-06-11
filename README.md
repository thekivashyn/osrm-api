# Routing API

Internal REST API for road routing + **Pelias** geocoding (server-hosted), built with **Bun** + **Elysia** + React console UI.

## Architecture

```
Local dev:  UI (:80) + API (:8080) → OSRM local (:5050) + Pelias remote (server :4000)
Production: nginx (:80) + API (:8080) → OSRM + Pelias (same server)
```

| Layer | Local dev | Production server |
|-------|-----------|-------------------|
| **OSRM** | Docker `:5050/:5051` | Docker |
| **Pelias** | **Remote** `149.28.134.50:4000` | Docker `:4000` |
| **API / UI** | `bun run dev` | systemd + nginx |

## Local dev (Mac)

```bash
bun install
bun run osrm:prepare
bun run osrm:up          # routing only — no Pelias locally

bun run dev              # API + UI; geocode hits server Pelias (.env.development)
```

`.env.development` sets `PELIAS_URL=http://149.28.134.50:4000`. Server must allow your IP (`scripts/allow-dev-ip.sh`) or use tunnel:

```bash
bun run dev:remote:tunnel   # SSH tunnel :4000/:5050/:5051
```

| Command | Local? |
|---------|--------|
| `bun run osrm:up` | Yes |
| `bun run pelias:import` | **Server only** |
| `bun run pelias:up` | **Server only** |
| `bun run geo:up` | **Server only** |

## Production server — Pelias

Chạy trên server (`/opt/routing-api`), không trên Mac dev:

```bash
bun run pelias:import   # one-time: 1–3+ hours, ~12GB RAM
bun run pelias:up
bun run pelias:logs
```

Config: `pelias/vietnam/`. Custom CSV: `data/custom-addresses/`.

`.env` on server:

```env
PELIAS_URL=http://127.0.0.1:4000
```

## Environment

| Variable | Dev (`.env.development`) | Server (`.env`) |
|----------|--------------------------|-----------------|
| `PELIAS_URL` | `http://149.28.134.50:4000` | `http://127.0.0.1:4000` |
| `OSRM_URL` | `http://localhost:5050` | `http://127.0.0.1:5050` |

## License

Internal use only.
