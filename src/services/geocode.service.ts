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
  /** Pelias layer: address, street, venue, locality, … */
  layer?: string;
}

export interface GeocodeSearchOptions {
  lat?: number;
  lng?: number;
}

const geocodeCache = new TtlCache<GeocodeResult[]>(config.geocodeCacheTtlMs);
const reverseCache = new TtlCache<GeocodeResult>(config.geocodeCacheTtlMs);

/** @internal test helper */
export function clearGeocodeCaches(): void {
  geocodeCache.clear();
  reverseCache.clear();
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

type PeliasFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    label?: string;
    name?: string;
    distance?: number;
    layer?: string;
  };
};

type PeliasResponse = {
  type: "FeatureCollection";
  features: PeliasFeature[];
};

function peliasBaseUrl(): string {
  return config.peliasUrl.replace(/\/$/, "");
}

function mapPeliasFeatures(
  features: PeliasFeature[],
  bias: { lat: number; lng: number } | null,
): GeocodeResult[] {
  return features.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties ?? {};
    const displayName = props.label ?? props.name ?? `${lat}, ${lng}`;
    const result: GeocodeResult = {
      lat,
      lng,
      displayName,
      layer: props.layer,
    };
    if (typeof props.distance === "number" && Number.isFinite(props.distance)) {
      result.distanceKm = props.distance / 1000;
    } else if (bias) {
      result.distanceKm = haversineKm(bias.lat, bias.lng, lat, lng);
    }
    return result;
  });
}

function buildPeliasUrl(path: string, params: Record<string, string>): URL {
  const url = new URL(`${peliasBaseUrl()}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url;
}

const PELIAS_TIMEOUT_MS = 4_000;

async function peliasFetch(url: URL): Promise<PeliasResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": config.geocodeUserAgent },
      signal: AbortSignal.timeout(PELIAS_TIMEOUT_MS),
    });
  } catch {
    throw new AppError("Geocoding service unreachable", 502);
  }

  if (!response.ok) {
    throw new AppError(`Geocoding failed with HTTP ${response.status}`, 502);
  }

  const data = (await response.json()) as PeliasResponse;
  if (!data || !Array.isArray(data.features)) {
    throw new AppError("Invalid geocoding response", 502);
  }
  return data;
}

export async function checkPeliasStatus(): Promise<{
  ok: boolean;
  url: string;
  message: string;
}> {
  const url = peliasBaseUrl();

  try {
    const probe = buildPeliasUrl("/v1/autocomplete", {
      text: "Bitexco",
      size: "1",
    });
    const res = await fetch(probe, {
      headers: { "User-Agent": config.geocodeUserAgent },
      signal: AbortSignal.timeout(PELIAS_TIMEOUT_MS),
    });

    if (res.ok) {
      return { ok: true, url, message: "Pelias ready" };
    }

    return {
      ok: false,
      url,
      message: `HTTP ${res.status} — index may still be importing`,
    };
  } catch {
    return {
      ok: false,
      url,
      message: `Cannot reach Pelias at ${url}. Prod: bun run pelias:import on server. Dev: check PELIAS_URL / allow-dev-ip.`,
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

  const bias = parseBiasCoords(options.lat, options.lng);
  const params: Record<string, string> = {
    text: q,
    size: String(cappedLimit),
    lang: "vi",
    "boundary.country": "VNM",
  };

  if (bias) {
    params["focus.point.lat"] = String(bias.lat);
    params["focus.point.lon"] = String(bias.lng);
  }

  // Autocomplete for partial input; search for longer structured queries.
  const endpoint = q.length >= 12 || /\d/.test(q) ? "/v1/search" : "/v1/autocomplete";
  const data = await peliasFetch(buildPeliasUrl(endpoint, params));

  if (data.features.length === 0) {
    geocodeCache.set(cacheKey, []);
    return [];
  }

  const results = mapPeliasFeatures(data.features, bias);
  if (bias) {
    results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
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

  const data = await peliasFetch(
    buildPeliasUrl("/v1/reverse", {
      "point.lat": String(lat),
      "point.lon": String(lng),
      size: "1",
      lang: "vi",
    }),
  );

  const feature = data.features[0];
  if (!feature) {
    throw new AppError("No address found", 404);
  }

  const mapped = mapPeliasFeatures([feature], null)[0];
  reverseCache.set(cacheKey, mapped);
  return mapped;
}
