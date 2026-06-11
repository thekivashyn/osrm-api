/**
 * Vietnam July-2025 administrative reorganization mapping
 * (63 → 34 provinces, districts abolished, 10,602 → 3,321 wards).
 *
 * OSM/WOF data in the Pelias index still carries the LEGACY hierarchy while
 * real-world addresses are now written in the new ward-province format (no
 * district). This module rewrites queries between the two eras so both keep
 * matching, e.g.:
 *
 *   "230/25 Lạc Long Quân, Bình Thới, HCM"
 *     → "230/25 Lạc Long Quân, Quận 11, Thành phố Hồ Chí Minh"   (legacy era)
 *   "Phường Bến Nghé, Quận 1, TPHCM"
 *     → "Phường Sài Gòn, Thành phố Hồ Chí Minh"                  (current era)
 *
 * Data: src/data/vn-admin-2025.json — names only, built by
 * scripts/build-vn-admin-data.ts from tranngocminhhieu/vietnamadminunits (MIT).
 */

import rawData from "../data/vn-admin-2025.json";

type AdminData = {
  names: string[];
  provinces: Array<{ legacy: string; current: string }>;
  wards: Array<{
    p: number;
    w: string;
    lat: number;
    lon: number;
    legacy: Array<[number, number, string]>;
  }>;
};

const data = rawData as unknown as AdminData;

/** Lowercase, strip diacritics (đ → d), collapse whitespace. */
export function normalizeAdminText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const WARD_PREFIX = /^(?:phuong|xa|thi tran|p|x|tt)[.\s]+/;
const DISTRICT_PREFIX = /^(?:quan|huyen|thi xa|q|h|tx)[.\s]+/;
const CITY_PREFIX = /^(?:thanh pho|tinh|tp)[.\s]+/;

type CoreName = {
  core: string;
  hadWardPrefix: boolean;
  hadDistrictPrefix: boolean;
  hadCityPrefix: boolean;
};

/** Strip one administrative-unit prefix and report which kind it was. */
function coreName(s: string): CoreName {
  const norm = normalizeAdminText(s);
  for (const [re, kind] of [
    [WARD_PREFIX, "ward"],
    [DISTRICT_PREFIX, "district"],
    [CITY_PREFIX, "city"],
  ] as const) {
    const m = norm.match(re);
    if (m) {
      return {
        core: norm.slice(m[0].length).replace(/^[.\s]+/, "").trim(),
        hadWardPrefix: kind === "ward",
        hadDistrictPrefix: kind === "district",
        hadCityPrefix: kind === "city",
      };
    }
  }
  return { core: norm, hadWardPrefix: false, hadDistrictPrefix: false, hadCityPrefix: false };
}

/** Common shorthand for the big cities, mapped to current full names. */
const PROVINCE_SLANG: Record<string, string> = {
  hcm: "Thành phố Hồ Chí Minh",
  tphcm: "Thành phố Hồ Chí Minh",
  hcmc: "Thành phố Hồ Chí Minh",
  sg: "Thành phố Hồ Chí Minh",
  "sai gon": "Thành phố Hồ Chí Minh",
  "ho chi minh city": "Thành phố Hồ Chí Minh",
  hn: "Thành phố Hà Nội",
  "ha noi city": "Thành phố Hà Nội",
};

type ProvinceInfo = { currentFull?: string; legacyFull?: string; currentForLegacy?: string };

type LegacyWardRef = {
  ward: string;
  district: string;
  districtCore: string;
  provinceFull: string;
  newWard: string;
  newProvince: string;
};

type CurrentWard = {
  w: string;
  provinceFull: string;
  legacy: Array<{ ward: string; district: string; province: string }>;
};

const provinceInfoByCore = new Map<string, ProvinceInfo>();
const wardIndex = new Map<string, { current: CurrentWard[]; legacy: LegacyWardRef[] }>();

function wardBucket(core: string) {
  let bucket = wardIndex.get(core);
  if (!bucket) {
    bucket = { current: [], legacy: [] };
    wardIndex.set(core, bucket);
  }
  return bucket;
}

for (const { legacy, current } of data.provinces) {
  const legacyCore = coreName(legacy).core;
  const currentCore = coreName(current).core;
  const e1 = provinceInfoByCore.get(legacyCore) ?? {};
  e1.legacyFull = legacy;
  e1.currentForLegacy = current;
  provinceInfoByCore.set(legacyCore, e1);
  const e2 = provinceInfoByCore.get(currentCore) ?? {};
  e2.currentFull = current;
  provinceInfoByCore.set(currentCore, e2);
}

for (const ward of data.wards) {
  const provinceFull = data.names[ward.p] ?? "";
  const legacyRefs = ward.legacy.map(([pi, di, wn]) => ({
    ward: wn,
    district: data.names[di] ?? "",
    province: data.names[pi] ?? "",
  }));
  wardBucket(coreName(ward.w).core).current.push({
    w: ward.w,
    provinceFull,
    legacy: legacyRefs,
  });
  for (const ref of legacyRefs) {
    wardBucket(coreName(ref.ward).core).legacy.push({
      ward: ref.ward,
      district: ref.district,
      districtCore: coreName(ref.district).core,
      provinceFull: ref.province,
      newWard: ward.w,
      newProvince: provinceFull,
    });
  }
}

/** Resolve a segment to a current-era province full name, if it names one. */
function matchProvince(segment: string): string | null {
  const c = coreName(segment);
  if (c.hadWardPrefix || c.hadDistrictPrefix) return null;
  const slang = PROVINCE_SLANG[c.core];
  if (slang) return slang;
  const info = provinceInfoByCore.get(c.core);
  if (!info) return null;
  return info.currentFull ?? info.currentForLegacy ?? null;
}

function isNumeric(core: string): boolean {
  return /^\d+$/.test(core);
}

type Rebuild = {
  segments: string[];
  wardIdx: number;
  districtIdx: number;
  provIdx: number;
};

function rebuild(ctx: Rebuild, wardParts: string[], provinceFull: string): string {
  const parts: string[] = [];
  ctx.segments.forEach((seg, i) => {
    if (i === ctx.wardIdx) {
      parts.push(...wardParts);
    } else if (i === ctx.districtIdx || i === ctx.provIdx) {
      // Replacement carries its own district/province context.
    } else {
      parts.push(seg);
    }
  });
  parts.push(provinceFull);
  return parts.join(", ");
}

/** Map any province/region name (legacy or current era) to its current name. */
export function currentProvinceName(name: string): string {
  const info = provinceInfoByCore.get(coreName(name).core);
  return info?.currentForLegacy ?? info?.currentFull ?? name;
}

type WardCentroid = { w: string; provinceFull: string; provinceCore: string; lat: number; lon: number };

const wardCentroids: WardCentroid[] = data.wards
  .filter((w) => w.lat !== 0 && w.lon !== 0)
  .map((w) => {
    const provinceFull = data.names[w.p] ?? "";
    return {
      w: w.w,
      provinceFull,
      provinceCore: coreName(provinceFull).core,
      lat: w.lat,
      lon: w.lon,
    };
  });

const NEAREST_WARD_MAX_KM = 15;

/**
 * Best-effort current-era ward for a coordinate via nearest ward centroid
 * (no post-2025 boundary polygons exist in open data yet). Wrong near ward
 * borders but good enough for display labels.
 */
export function nearestCurrentWard(
  lat: number,
  lng: number,
  provinceName?: string,
): { ward: string; province: string } | null {
  const provCore = provinceName ? coreName(currentProvinceName(provinceName)).core : null;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best: WardCentroid | null = null;
  let bestD2 = Infinity;
  for (const w of wardCentroids) {
    if (provCore && w.provinceCore !== provCore) continue;
    const dLat = w.lat - lat;
    const dLon = (w.lon - lng) * cosLat;
    const d2 = dLat * dLat + dLon * dLon;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = w;
    }
  }
  if (!best) return null;
  const km = Math.sqrt(bestD2) * 111.32;
  if (km > NEAREST_WARD_MAX_KM) return null;
  return { ward: best.w, province: best.provinceFull };
}

/**
 * Produce up to `max` query rewrites translating admin names between the
 * pre- and post-2025 hierarchies. Returns [] when no admin names are found.
 */
export function expandAdminVariants(query: string, max = 3): string[] {
  const segments = query
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return [];

  let provIdx = -1;
  let provinceFull: string | null = null;
  for (let i = segments.length - 1; i >= 0; i--) {
    const match = matchProvince(segments[i] as string);
    if (match) {
      provIdx = i;
      provinceFull = match;
      break;
    }
  }
  const provCore = provinceFull ? coreName(provinceFull).core : null;

  let districtIdx = -1;
  let districtCore: string | null = null;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (i === provIdx) continue;
    const c = coreName(segments[i] as string);
    if (c.hadDistrictPrefix) {
      districtIdx = i;
      districtCore = c.core;
      break;
    }
  }

  let wardIdx = -1;
  let bucket: { current: CurrentWard[]; legacy: LegacyWardRef[] } | undefined;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (i === provIdx || i === districtIdx) continue;
    const seg = segments[i] as string;
    const c = coreName(seg);
    // A digit-bearing head without a ward prefix is the street part.
    if (i === 0 && segments.length > 1 && /\d/.test(seg) && !c.hadWardPrefix) continue;
    if (c.hadDistrictPrefix || c.hadCityPrefix || !c.core) continue;
    if (isNumeric(c.core) && !c.hadWardPrefix) continue;
    const found = wardIndex.get(c.core);
    if (!found) continue;
    if (isNumeric(c.core) && found.legacy.length > 0 && districtIdx === -1) {
      // "Phường 3" without a district is ambiguous across all old districts.
      continue;
    }
    wardIdx = i;
    bucket = found;
    break;
  }

  const ctx: Rebuild = { segments, wardIdx, districtIdx, provIdx };
  const variants: string[] = [];

  if (bucket && wardIdx >= 0) {
    const provMatches = (p: string) => !provCore || coreName(p).core === provCore;

    const current = bucket.current.filter((c) => provMatches(c.provinceFull))[0];
    if (current) {
      const first = current.legacy[0];
      if (first) {
        // District alone disambiguates without guessing the exact old ward.
        variants.push(rebuild(ctx, [first.district], first.province));
        variants.push(rebuild(ctx, [first.ward, first.district], first.province));
      }
      variants.push(rebuild(ctx, [current.w], current.provinceFull));
    }

    const legacy = bucket.legacy.filter(
      (l) =>
        provMatches(l.provinceFull) && (!districtCore || l.districtCore === districtCore),
    )[0];
    if (legacy) {
      variants.push(rebuild(ctx, [legacy.newWard], legacy.newProvince));
    }
  } else if (provIdx >= 0) {
    const info = provinceInfoByCore.get(coreName(segments[provIdx] as string).core);
    // A dissolved province name ("Bình Dương") must be rewritten to its
    // current province for the new-era hierarchy to ever match.
    if (info?.legacyFull && info.currentForLegacy && info.currentForLegacy !== info.legacyFull) {
      const rewritten = segments.map((s, i) => (i === provIdx ? info.currentForLegacy! : s));
      variants.push(rewritten.join(", "));
    }
  }

  const seen = new Set<string>([query.trim().toLowerCase()]);
  return variants
    .filter((v) => {
      const key = v.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}
