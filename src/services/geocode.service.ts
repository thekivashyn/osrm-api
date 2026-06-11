import { config } from "../config/env";
import { AppError } from "../utils/response";
import { haversineKm } from "../utils/geo";
import { TtlCache } from "../utils/ttl-cache";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  /** Distance from search bias point in km, when bias coords provided. */
  distanceKm?: number;
}

export interface GeocodeSearchOptions {
  lat?: number;
  lng?: number;
  /** Half-width of Nominatim viewbox in degrees (~0.35 ≈ 38 km at HCMC latitude). */
  biasDelta?: number;
}

const geocodeCache = new TtlCache<GeocodeResult[]>(config.geocodeCacheTtlMs);
const reverseCache = new TtlCache<GeocodeResult>(config.geocodeCacheTtlMs);

/** @internal test helper */
export function clearGeocodeCaches(): void {
  geocodeCache.clear();
  reverseCache.clear();
}

/** Nominatim viewbox: left, top, right, bottom (lon/lat corners). */
export function buildViewbox(lat: number, lng: number, delta: number): string {
  const f = (n: number) => n.toFixed(5);
  return [
    f(lng - delta),
    f(lat + delta),
    f(lng + delta),
    f(lat - delta),
  ].join(",");
}

function geocodeCacheKey(query: string, limit: number, options: GeocodeSearchOptions): string {
  const lat = options.lat != null ? options.lat.toFixed(3) : "";
  const lng = options.lng != null ? options.lng.toFixed(3) : "";
  return `${query.toLowerCase()}|${limit}|${lat}|${lng}`;
}

function parseBiasCoords(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } | null {
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  ) {
    return { lat, lng };
  }
  return null;
}

function mapRows(
  rows: Array<{ lat: string; lon: string; display_name: string }>,
  options: GeocodeSearchOptions,
): GeocodeResult[] {
  const bias = parseBiasCoords(options.lat, options.lng);
  return rows.map((row) => {
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    const result: GeocodeResult = {
      lat,
      lng,
      displayName: row.display_name,
    };
    if (bias) {
      result.distanceKm = haversineKm(bias.lat, bias.lng, lat, lng);
    }
    return result;
  });
}

export async function checkNominatimStatus(): Promise<{
  ok: boolean;
  url: string;
  message: string;
}> {
  const url = config.nominatimUrl.replace(/\/$/, "");

  try {
    const res = await fetch(`${url}/status`);
    const text = (await res.text()).trim();

    if (res.ok && text.includes("OK")) {
      return { ok: true, url, message: "Nominatim ready" };
    }

    return {
      ok: false,
      url,
      message: text || `HTTP ${res.status} — import may still be running`,
    };
  } catch {
    return {
      ok: false,
      url,
      message: `Cannot reach Nominatim at ${url}. Run: bun run nominatim:up`,
    };
  }
}

export async function searchAddress(
  query: string,
  limit = 5,
  options: GeocodeSearchOptions = {},
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) {
    throw new AppError("Query is required");
  }

  const cappedLimit = Math.min(limit, 10);
  const cacheKey = geocodeCacheKey(q, cappedLimit, options);
  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL(`${config.nominatimUrl}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(cappedLimit));
  url.searchParams.set("countrycodes", "vn");
  url.searchParams.set("accept-language", "vi");

  const { lat, lng, biasDelta = 0.35 } = options;
  const bias = parseBiasCoords(lat, lng);
  if (bias) {
    url.searchParams.set("viewbox", buildViewbox(bias.lat, bias.lng, biasDelta));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": config.geocodeUserAgent },
    });
  } catch {
    throw new AppError("Geocoding service unreachable", 502);
  }

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") || 60);
      throw new AppError(
        `Geocoding rate limited (429). Public Nominatim max ~1 req/s — thử lại sau ${retryAfter}s`,
        429,
      );
    }
    throw new AppError(`Geocoding failed with HTTP ${response.status}`, 502);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new AppError("Geocoding rate limited — đợi ~60 giây rồi thử lại", 429);
  }

  const rows = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError("No address found", 404);
  }

  const results = mapRows(rows, options);
  geocodeCache.set(cacheKey, results);
  return results;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const coords = parseBiasCoords(lat, lng);
  if (!coords) {
    throw new AppError("Invalid coordinates");
  }

  const cacheKey = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL(`${config.nominatimUrl}/reverse`);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("accept-language", "vi");
  url.searchParams.set("countrycodes", "vn");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": config.geocodeUserAgent },
    });
  } catch {
    throw new AppError("Geocoding service unreachable", 502);
  }

  if (!response.ok) {
    throw new AppError(`Reverse geocoding failed with HTTP ${response.status}`, 502);
  }

  const row = (await response.json()) as {
    lat?: string;
    lon?: string;
    display_name?: string;
    error?: string;
  };

  if (!row.display_name) {
    throw new AppError(row.error || "No address found", 404);
  }

  const result: GeocodeResult = {
    lat: Number(row.lat ?? coords.lat),
    lng: Number(row.lon ?? coords.lng),
    displayName: row.display_name,
  };

  reverseCache.set(cacheKey, result);
  return result;
}
