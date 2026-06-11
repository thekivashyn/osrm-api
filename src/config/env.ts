export const config = {
  get host() {
    return process.env.HOST ?? "127.0.0.1";
  },
  get port() {
    return Number(process.env.PORT ?? 8080);
  },
  get osrmUrl() {
    return process.env.OSRM_URL ?? "http://localhost:5050";
  },
  get osrmMotorUrl() {
    return process.env.OSRM_MOTOR_URL ?? "http://localhost:5051";
  },
  get geocodeCacheTtlMs() {
    const raw = Number(process.env.GEOCODE_CACHE_TTL_MS ?? 300_000);
    return Number.isFinite(raw) && raw > 0 ? raw : 300_000;
  },
  get routeCacheTtlMs() {
    const raw = Number(process.env.ROUTE_CACHE_TTL_MS ?? 600_000);
    return Number.isFinite(raw) && raw > 0 ? raw : 600_000;
  },
  serviceName: "routing-api",
  version: "1.0.0",
  get peliasUrl() {
    return process.env.PELIAS_URL ?? "http://127.0.0.1:4000";
  },
  geocodeUserAgent: process.env.GEOCODE_USER_AGENT ?? "routing-api-internal/1.0 (dev playground)",
  get buildingsDataDir() {
    return process.env.BUILDINGS_DATA_DIR ?? "data/buildings";
  },
  get buildingsSourcePbf() {
    return process.env.BUILDINGS_SOURCE_PBF ?? "data/vietnam-latest.osm.pbf";
  },
  get carDurationFactor() {
    const raw = Number(
      process.env.ROUTING_DURATION_FACTOR_CAR ?? process.env.ROUTING_DURATION_FACTOR ?? 1.25,
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  },
  get motorbikeDurationFactor() {
    const raw = Number(process.env.ROUTING_DURATION_FACTOR_MOTORBIKE ?? 0.85);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  },
} as const;
