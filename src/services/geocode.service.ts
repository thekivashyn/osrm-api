import { config } from "../config/env";
import { AppError } from "../utils/response";
import { haversineKm } from "../utils/geo";
import { TtlCache } from "../utils/ttl-cache";
import {
  currentProvinceName,
  expandAdminVariants,
  nearestCurrentWard,
  normalizeAdminText,
} from "./vn-admin";
import { estimateAlleyHousePosition } from "../utils/alley-geometry";
import {
  parsePlainHouseStreet,
  snapToStreetHouse,
  type StreetSnapInput,
} from "../utils/street-interpolation";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  /** Distance from search bias point in km, when bias coords provided. */
  distanceKm?: number;
  /** Pelias layer: address, street, venue, locality, … */
  layer?: string;
  /** Alley mouth on the main road — present for compound alley estimates (e.g. 230/25). */
  alleyMouth?: { lat: number; lng: number };
  /** True when coordinates were estimated from neighbours (not an indexed pin). */
  estimated?: boolean;
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
    /** "exact" | "interpolated" | "fallback" — only set by /v1/search. */
    match_type?: string;
    housenumber?: string;
    street?: string;
    /** Province/city — may still be the pre-2025 hierarchy (WOF). */
    region?: string;
    locality?: string;
    id?: string;
    gid?: string;
    _alleyMouthLat?: number;
    _alleyMouthLng?: number;
  };
};

type PeliasResponse = {
  type: "FeatureCollection";
  features: PeliasFeature[];
};

function peliasBaseUrl(): string {
  return config.peliasUrl.replace(/\/$/, "");
}

/** Layers that describe a point on a street, where a ward label makes sense. */
const WARD_LABEL_LAYERS = new Set(["address", "venue", "street"]);

/**
 * Display format per product decision: "<name>, <phường mới>, <tỉnh/TP mới>".
 * Drops the abolished district level and maps provinces through the 2025
 * reorganization; ward comes from the nearest current-era ward centroid.
 */
function formatDisplayName(f: PeliasFeature): string {
  const [lng, lat] = f.geometry.coordinates;
  const props = f.properties ?? {};
  const name = props.name ?? (props.label ?? "").split(",")[0]?.trim() ?? `${lat}, ${lng}`;
  const provinceRaw = props.region ?? props.locality;

  const parts = [name];
  if (props.layer && WARD_LABEL_LAYERS.has(props.layer)) {
    const wardInfo = nearestCurrentWard(lat, lng, provinceRaw);
    if (wardInfo && !normalizeAdminText(name).includes(normalizeAdminText(wardInfo.ward))) {
      parts.push(wardInfo.ward);
    }
  }
  if (provinceRaw) {
    const province = currentProvinceName(provinceRaw);
    if (!normalizeAdminText(name).includes(normalizeAdminText(province))) {
      parts.push(province);
    }
  }
  return parts.join(", ");
}

function mapPeliasFeatures(
  features: PeliasFeature[],
  bias: { lat: number; lng: number } | null,
): GeocodeResult[] {
  return features.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    const props = f.properties ?? {};
    const result: GeocodeResult = {
      lat,
      lng,
      displayName: formatDisplayName(f),
      layer: props.layer,
    };
    const mouthLat = (props as { _alleyMouthLat?: number })._alleyMouthLat;
    const mouthLng = (props as { _alleyMouthLng?: number })._alleyMouthLng;
    if (Number.isFinite(mouthLat) && Number.isFinite(mouthLng)) {
      result.alleyMouth = { lat: mouthLat!, lng: mouthLng! };
    }
    if (typeof props.distance === "number" && Number.isFinite(props.distance)) {
      // Pelias returns `distance` already in kilometers.
      result.distanceKm = props.distance;
    } else if (bias) {
      result.distanceKm = haversineKm(bias.lat, bias.lng, lat, lng);
    }
    if (props.match_type === "interpolated") {
      result.estimated = true;
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

/** Results within this radius of the GPS bias are tried first, so a search
 *  in HCM never jumps to a same-named street in Hà Nội. */
/** Tighter radius when hunting same-alley crowd pins (km). */
const ALLEY_SNAP_RADIUS_KM = 3;

/** Radius for gathering venue/address anchors on the same street (km). */
const STREET_SNAP_RADIUS_KM = 12;

/** Keep street-snap anchors/features within this distance of the search bias (km). */
const STREET_SNAP_LOCAL_KM = 8;

/** Results within this radius of the GPS bias are tried first. */
const NEARBY_RADIUS_KM = 75;

/**
 * Progressive simplification for VN addresses that OSM rarely has verbatim:
 * "230/25 Lạc Long Quân, Bình Thới, HCM" →
 *   ["230/25 Lạc Long Quân, Bình Thới, HCM", "230/25 Lạc Long Quân",
 *    "Hẻm 230 Lạc Long Quân" (OSM maps alleys as streets),
 *    "230 Lạc Long Quân" (alley mouth), "Lạc Long Quân"]
 */
type QueryVariant = {
  text: string;
  /** Synthetic "Hẻm/Ngõ N <street>" guess — only street-layer hits make sense. */
  streetLayerOnly?: boolean;
  /** Result label/name must contain this (lowercase) — kills fuzzy strays. */
  requireText?: string;
  /**
   * "230/25 X" with no exact data: find neighbours in the same alley
   * ("230/18 X" crowd-sourced pins) and snap an estimated result to the
   * closest house number. Runs through autocomplete (libpostal splits
   * compound numbers, killing /v1/search for this case).
   */
  alleySnap?: { alley: string; house: string; street: string };
  /** "865 Nguyễn Xiển" with no exact pin — interpolate from venue/address neighbours. */
  streetSnap?: StreetSnapInput;
};

function buildQueryVariants(q: string): QueryVariant[] {
  const variants: QueryVariant[] = [{ text: q }];
  // Pre/post-2025 admin reorg rewrites ("Bình Thới, HCM" → "Quận 11, TPHCM")
  // rank as full-precision interpretations, right after the verbatim query.
  for (const text of expandAdminVariants(q)) variants.push({ text });
  const head = (q.split(",")[0] ?? "").trim();
  if (head && head !== q) variants.push({ text: head });
  // "230/25 X" = house 25 inside alley 230; "269/22/4/25 X" = house 25
  // inside nested alley 269/22/4 (OSM names alleys as streets).
  const alley = head.match(/^(\d+(?:\/\d+)*)\/(\d+)\s+(.+)/);
  if (alley && !/^(hẻm|ngõ|ngách)\s/i.test(head)) {
    const [, chain, house, street] = alley;
    // Crowd-sourced pins of neighbours in the same alley ("230/18 …").
    variants.push({
      text: `${chain} ${street}`,
      alleySnap: { alley: chain as string, house: house as string, street: street as string },
    });
    // House number on the alley street — exact OSM point or interpolated.
    // requireText pins results to the actual alley (no "Ngõ"→"Ngô" strays).
    variants.push({ text: `${house} Hẻm ${chain} ${street}`, requireText: `hẻm ${chain}` });
    variants.push({ text: `${house} Ngõ ${chain} ${street}`, requireText: `ngõ ${chain}` });
    // The alley itself.
    variants.push({ text: `Hẻm ${chain} ${street}`, streetLayerOnly: true }); // miền Nam
    variants.push({ text: `Ngõ ${chain} ${street}`, streetLayerOnly: true }); // miền Bắc
  }
  const alleyMouth = head.replace(/^(\d+)\/[\d/]+\s+/, "$1 ");
  if (alleyMouth && alleyMouth !== head) variants.push({ text: alleyMouth });
  const streetOnly = head.replace(/^[\d/]+\s+/, "");
  if (streetOnly && streetOnly !== head) variants.push({ text: streetOnly });
  const plainHouse = parsePlainHouseStreet(head);
  if (plainHouse) variants.push({ text: head, streetSnap: plainHouse });
  const seen = new Set<string>();
  return variants.filter((v) => {
    // Same text may legitimately run twice with different semantics
    // (alley-snap via autocomplete vs alley-mouth via /v1/search).
    const key = `${v.text}|${v.alleySnap ? "snap" : v.streetSnap ? "street" : v.streetLayerOnly ? "street" : (v.requireText ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function peliasQuery(
  text: string,
  size: number,
  bias: { lat: number; lng: number } | null,
  nearbyOnly: boolean,
  forceAutocomplete = false,
  nearbyRadiusKm = NEARBY_RADIUS_KM,
): Promise<PeliasFeature[]> {
  const params: Record<string, string> = {
    text,
    size: String(size),
    lang: "vi",
    "boundary.country": "VNM",
  };
  if (bias) {
    params["focus.point.lat"] = String(bias.lat);
    params["focus.point.lon"] = String(bias.lng);
    if (nearbyOnly) {
      params["boundary.circle.lat"] = String(bias.lat);
      params["boundary.circle.lon"] = String(bias.lng);
      params["boundary.circle.radius"] = String(nearbyRadiusKm);
    }
  }
  // Compound numbers ("230/25") must skip /v1/search: libpostal splits them
  // into unit+housenumber and never matches the indexed "230/25" docs, while
  // autocomplete token-matches names directly. Other digit-bearing queries
  // get structured parsing + interpolation via /v1/search; plain names rank
  // much better through /v1/autocomplete.
  const compound = /\d+\/\d+/.test(text);
  const endpoint =
    forceAutocomplete || compound || !/\d/.test(text) ? "/v1/autocomplete" : "/v1/search";
  const data = await peliasFetch(buildPeliasUrl(endpoint, params));
  return data.features;
}

function withAlleyMouth(
  feature: PeliasFeature,
  mouth: { lat: number; lng: number } | null,
): PeliasFeature {
  if (!mouth) return feature;
  return {
    ...feature,
    properties: {
      ...feature.properties,
      _alleyMouthLat: mouth.lat,
      _alleyMouthLng: mouth.lng,
    },
  };
}

function mouthFrom(mouthFeature: PeliasFeature | undefined): { lat: number; lng: number } | null {
  if (!mouthFeature) return null;
  const [lng, lat] = mouthFeature.geometry.coordinates;
  return { lat, lng };
}

function matchesAlleyStreetFeature(
  f: PeliasFeature,
  chain: string,
  streetNorm: string,
): boolean {
  const p = f.properties ?? {};
  if (p.layer !== "street") return false;
  const label = normalizeAdminText(`${p.name ?? ""} ${p.label ?? ""}`);
  const escaped = chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\/");
  if (!label.includes(streetNorm)) return false;
  return new RegExp(`(?:^|[\\s,])(?:hem|ngo|ngach)\\s*${escaped}(?:\\s|,|$)`).test(label);
}

/**
 * "230/25 Lạc Long Quân" with no exact pin: crowd-sourced data usually has
 * a neighbour in the same alley ("230/18 Hẻm 230 Lạc Long Quân"). Snap to
 * the closest house number and mark the result as an estimate — same
 * behaviour as commercial geocoders for unmapped house numbers.
 */
function snapToAlleyNeighbour(
  features: PeliasFeature[],
  snap: { alley: string; house: string; street: string },
): { feature: PeliasFeature; mouth: { lat: number; lng: number } | null } | null {
  const prefix = `${snap.alley}/`;
  const streetNorm = normalizeAdminText(snap.street);

  const mouthFeature = features.find((f) => matchesAlleyStreetFeature(f, snap.alley, streetNorm));

  const candidates = features.filter((f) => {
    const p = f.properties ?? {};
    if (p.layer !== "address" || !p.housenumber?.startsWith(prefix)) return false;
    return normalizeAdminText(`${p.street ?? ""} ${p.name ?? ""}`).includes(streetNorm);
  });
  if (candidates.length === 0 && !mouthFeature) return null;

  const target = Number(snap.house);
  const exact = `${snap.alley}/${snap.house}`;
  const exactHit = candidates.find((f) => f.properties?.housenumber === exact);
  if (exactHit) {
    const mouth = mouthFrom(mouthFeature);
    return { feature: withAlleyMouth(exactHit, mouth), mouth };
  }

  const suffixNumber = (housenumber: string) =>
    Number(housenumber.slice(prefix.length).match(/^\d+/)?.[0] ?? Number.NaN);

  const anchors = candidates
    .map((f) => {
      const n = suffixNumber(f.properties?.housenumber ?? "");
      const [lng, lat] = f.geometry.coordinates;
      return Number.isFinite(n) ? { house: n, lat, lng } : null;
    })
    .filter((a): a is { house: number; lat: number; lng: number } => a != null);

  const mouth = mouthFrom(mouthFeature);

  const estimated = estimateAlleyHousePosition(target, mouth, anchors);
  if (!estimated) {
    const best = candidates.reduce((a, b) => {
      const da = Math.abs(suffixNumber(a.properties?.housenumber ?? "") - target);
      const db = Math.abs(suffixNumber(b.properties?.housenumber ?? "") - target);
      return db < da ? b : a;
    });
    return { feature: withAlleyMouth(best, mouth), mouth };
  }

  const [estLng, estLat] = estimated;
  const template = candidates[0] ?? mouthFeature;
  if (!template) return null;

  const feature: PeliasFeature = withAlleyMouth(
    {
      ...template,
      geometry: { type: "Point", coordinates: [estLng, estLat] },
      properties: {
        ...template.properties,
        name: `${exact} ${snap.street}`,
        housenumber: exact,
        match_type: "interpolated",
      },
    },
    mouth,
  );

  return { feature, mouth };
}

function mergePeliasFeatures(a: PeliasFeature[], b: PeliasFeature[]): PeliasFeature[] {
  const seen = new Set<string>();
  const out: PeliasFeature[] = [];
  for (const f of [...a, ...b]) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry.coordinates;
    const key = `${p.gid ?? p.id ?? ""}|${lat.toFixed(5)}|${lng.toFixed(5)}|${p.name ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function filterFeaturesNearBias(
  features: PeliasFeature[],
  bias: { lat: number; lng: number } | null,
  maxKm: number,
): PeliasFeature[] {
  if (!bias) return features;
  return features.filter((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return haversineKm(bias.lat, bias.lng, lat, lng) <= maxKm;
  });
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
  const variants = buildQueryVariants(q);
  const streetSnapInput = variants.find((v) => v.streetSnap)?.streetSnap;

  const queryPromises: Promise<PeliasFeature[]>[] = variants.map((v) =>
    peliasQuery(
      v.text,
      v.alleySnap || v.streetSnap ? 25 : cappedLimit,
      bias,
      bias != null,
      Boolean(v.alleySnap || v.streetSnap),
      v.alleySnap
        ? ALLEY_SNAP_RADIUS_KM
        : v.streetSnap
          ? STREET_SNAP_RADIUS_KM
          : NEARBY_RADIUS_KM,
    ),
  );

  let streetAnchorIdx = -1;
  let nationalIdx = -1;
  if (streetSnapInput) {
    streetAnchorIdx = queryPromises.length;
    // Citywide focus ranking — circle filter drops too many POI anchors away from bias.
    queryPromises.push(
      peliasQuery(streetSnapInput.street, 25, bias, false, true),
    );
  }
  if (bias) {
    nationalIdx = queryPromises.length;
    queryPromises.push(peliasQuery(q, cappedLimit, bias, false));
  }

  const settled = await Promise.allSettled(queryPromises);
  if (settled.every((s) => s.status === "rejected")) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }

  const streetAnchorFeatures =
    streetAnchorIdx >= 0 && settled[streetAnchorIdx]?.status === "fulfilled"
      ? (settled[streetAnchorIdx] as PromiseFulfilledResult<PeliasFeature[]>).value
      : [];
  const national =
    nationalIdx >= 0 && settled[nationalIdx]?.status === "fulfilled"
      ? (settled[nationalIdx] as PromiseFulfilledResult<PeliasFeature[]>).value
      : [];

  const sets = settled.map((s, i) => {
    if (i === nationalIdx || i === streetAnchorIdx) return [] as PeliasFeature[];
    return s.status === "fulfilled" ? s.value : [];
  });

  // Variant order encodes interpretation precision (verbatim → hẻm/ngõ →
  // alley mouth → street). Sets that are pure `match_type: "fallback"`
  // guesses (random street segments for an unmatched house number) rank
  // below every exact set.
  const exactSets: PeliasFeature[][] = [];
  const fallbackSets: PeliasFeature[][] = [];
  sets.forEach((features, i) => {
    const variant = variants[i];
    let kept = features;
    if (variant?.alleySnap) {
      const snapped = snapToAlleyNeighbour(features, variant.alleySnap);
      if (snapped) exactSets.push([snapped.feature]);
      return;
    }
    if (variant?.streetSnap) {
      const merged = mergePeliasFeatures(
        filterFeaturesNearBias(features, bias, STREET_SNAP_LOCAL_KM),
        filterFeaturesNearBias(streetAnchorFeatures, bias, STREET_SNAP_LOCAL_KM),
      );
      const snapped = snapToStreetHouse(merged, variant.streetSnap);
      if (snapped) exactSets.push([snapped.feature as PeliasFeature]);
      return;
    }
    if (variant?.streetLayerOnly) {
      // Only actual alleys — drops fuzzy hits like "Phạm Văn Ngô" street.
      kept = kept.filter(
        (f) =>
          f.properties?.layer === "street" &&
          /^(hẻm|ngõ|ngách)\s/i.test(f.properties?.name ?? f.properties?.label ?? ""),
      );
    }
    if (variant?.requireText) {
      kept = kept.filter((f) =>
        `${f.properties?.label ?? ""} ${f.properties?.name ?? ""}`
          .toLowerCase()
          .includes(variant.requireText as string),
      );
    }
    if (kept.length === 0) return;
    const fallbackOnly = kept.every((f) => f.properties?.match_type === "fallback");
    (fallbackOnly ? fallbackSets : exactSets).push(kept);
  });

  const merged: GeocodeResult[] = [];
  const seen = new Set<string>();
  const push = (r: GeocodeResult) => {
    const key = r.displayName.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(r);
  };

  // Diversity pass: top slice of each interpretation, then national extras.
  const DIVERSITY_CAP = 3;
  const ordered = [...exactSets, ...fallbackSets];
  for (const set of ordered) {
    for (const r of mapPeliasFeatures(set, bias).slice(0, DIVERSITY_CAP)) push(r);
  }
  for (const r of mapPeliasFeatures(national, bias).slice(0, 2)) push(r);
  // Fill pass: top up from already-ranked sets when diversity left slots.
  if (merged.length < cappedLimit) {
    for (const set of ordered) {
      for (const r of mapPeliasFeatures(set, bias).slice(DIVERSITY_CAP)) push(r);
    }
  }

  // Address intent ("số nhà" queries): prefer address pins over venue noise.
  let ranked = merged;
  if (/\d/.test(q)) {
    const addresses = merged.filter((r) => r.layer === "address");
    const venues = merged.filter((r) => r.layer === "venue");
    if (addresses.length > 0) ranked = [...addresses, ...venues];
    else if (venues.length > 0) ranked = venues;
  }

  const plainHouse = parsePlainHouseStreet((q.split(",")[0] ?? "").trim());
  if (plainHouse) {
    const token = `${plainHouse.house} `;
    ranked = [...ranked].sort((a, b) => {
      const tier = (r: GeocodeResult) =>
        r.layer === "address" && r.displayName.startsWith(token)
          ? 0
          : r.displayName.includes(plainHouse.house)
            ? 1
            : 2;
      return tier(a) - tier(b);
    });
  }

  // Compound queries ("230/25 X"): the exact house (or its alley-snap
  // estimate) must outrank everything, then same-alley neighbours, then the
  // fuzzy remainder — regardless of which variant set produced them.
  const compound = (q.split(",")[0] ?? "").match(/(\d+(?:\/\d+)*)\/(\d+)\s/);
  if (compound) {
    const exactToken = `${compound[1]}/${compound[2]} `;
    const alleyToken = `${compound[1]}/`;
    const tier = (r: GeocodeResult) =>
      r.displayName.includes(exactToken) ? 0 : r.displayName.includes(alleyToken) ? 1 : 2;
    ranked = [...ranked].sort((a, b) => tier(a) - tier(b));
  }

  const results = ranked.slice(0, cappedLimit);
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
