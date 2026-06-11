import { bearingDeg, haversineM, pointAlongBearing } from "./geo";
import type { GeocodeResult, Point } from "../types";

export type PickMode = "click" | "street-slider" | "building" | "alley";
export type ActiveField = "from" | "to";

export const ALLEY_HOUSE_SPACING_M = 5;
export const DEFAULT_ALLEY_BEARING = 190;
export const HALO_HINT_RADIUS_M = 120;
/** @deprecated use HALO_HINT_RADIUS_M — halo is visual hint only, not a click boundary */
export const HALO_RADIUS_M = HALO_HINT_RADIUS_M;
export const ALLEY_MAX_DEPTH_M = 250;
const MIN_MOUTH_ANCHOR_M = 8;

export interface AlleyPickState {
  chain: string;
  house: number;
  street: string;
  mouth: Point;
  bearing: number;
  depthM: number;
}

export interface PickSession {
  field: ActiveField;
  mode: PickMode;
  query: string;
  anchor: Point;
  candidates: GeocodeResult[];
  alley?: AlleyPickState;
  haloRadiusM: number;
}

export interface ParsedAlley {
  chain: string;
  house: number;
  street: string;
}

const ALLEY_RE = /^(\d+(?:\/\d+)*)\/(\d+)\s+(.+)/i;

export function parseAlleyQuery(query: string): ParsedAlley | null {
  const head = query.trim();
  const m = head.match(ALLEY_RE);
  if (!m || /^(hẻm|ngõ|ngách)\s/i.test(head)) return null;
  return { chain: m[1]!, house: Number(m[2]), street: m[3]!.trim() };
}

export function alleyQueryLabel(query: string, alley: ParsedAlley): string {
  const head = query.split(",")[0]?.trim();
  return head || `${alley.chain}/${alley.house} ${alley.street}`;
}

export function detectPickMode(query: string): PickMode {
  if (parseAlleyQuery(query)) return "alley";
  return "click";
}

export function pickModeLabel(_mode: PickMode): string {
  return "Di chuyển bản đồ · đặt pin giữa màn hình";
}

function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "Hẻm 230 Lạc Long Quân" — not Hẻm 2308 / Hẻm 23. */
export function matchesAlleyStreetName(displayName: string, chain: string, street: string): boolean {
  const norm = normalizeText(displayName);
  const streetN = normalizeText(street);
  if (!streetN || !norm.includes(streetN)) return false;
  const escaped = chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\/");
  return new RegExp(`(?:^|[\\s,])(?:hem|ngo|ngach)\\s*${escaped}(?:\\s|,|$)`).test(norm);
}

/** Main-road mouth number: "230 Lạc Long Quân" (no inner slash). */
function matchesAlleyMouthNumber(displayName: string, chain: string, street: string): boolean {
  const head = normalizeText(displayName.split(",")[0] ?? "");
  const streetN = normalizeText(street);
  const escaped = chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`^${escaped}\\s+`).test(head) && !head.includes("/") && head.includes(streetN)
  );
}

function houseFromAlleyAddress(displayName: string, chain: string): number | null {
  const escaped = chain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\/");
  const m = normalizeText(displayName).match(new RegExp(`${escaped}/(\\d+)`));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function resolveAlleyAnchor(
  alley: ParsedAlley,
  query: string,
  picked: GeocodeResult,
  candidates: GeocodeResult[],
): Point {
  const label = alleyQueryLabel(query, alley);
  const pool = [picked, ...candidates];
  const prefix = `${alley.chain}/`;
  const prefixNorm = normalizeText(prefix);

  const sameAlley = pool.filter((c) => normalizeText(c.displayName).includes(prefixNorm));
  if (sameAlley.length) {
    const target = alley.house;
    const ranked = sameAlley
      .map((c) => ({ c, house: houseFromAlleyAddress(c.displayName, alley.chain) }))
      .filter((x): x is { c: GeocodeResult; house: number } => x.house != null)
      .sort((a, b) => Math.abs(a.house - target) - Math.abs(b.house - target));

    const best = ranked[0]?.c ?? sameAlley[0]!;
    const useCoords =
      normalizeText(picked.displayName).includes(prefixNorm) &&
      picked.displayName.includes(String(alley.house))
        ? picked
        : best;
    return { lat: useCoords.lat, lng: useCoords.lng, name: label };
  }

  return { lat: picked.lat, lng: picked.lng, name: label };
}

function resolveAlleyMouth(
  alley: ParsedAlley,
  anchor: Point,
  picked: GeocodeResult,
  candidates: GeocodeResult[],
): Point {
  if (picked.alleyMouth) {
    return {
      lat: picked.alleyMouth.lat,
      lng: picked.alleyMouth.lng,
      name: `Hẻm ${alley.chain} ${alley.street}`,
    };
  }

  const pool = [...candidates, picked];
  const mouthHits = pool.filter(
    (c) =>
      matchesAlleyStreetName(c.displayName, alley.chain, alley.street) ||
      matchesAlleyMouthNumber(c.displayName, alley.chain, alley.street),
  );

  if (mouthHits.length) {
    mouthHits.sort(
      (a, b) =>
        haversineM(anchor.lat, anchor.lng, a.lat, a.lng) -
        haversineM(anchor.lat, anchor.lng, b.lat, b.lng),
    );
    const m = mouthHits[0]!;
    return { lat: m.lat, lng: m.lng, name: m.displayName };
  }

  return { lat: anchor.lat, lng: anchor.lng, name: `Hẻm ${alley.chain} ${alley.street}` };
}

function alleyBearingAndDepth(mouth: Point, anchor: Point, house: number): { bearing: number; depthM: number } {
  const dist = haversineM(mouth.lat, mouth.lng, anchor.lat, anchor.lng);
  if (dist >= MIN_MOUTH_ANCHOR_M) {
    return {
      bearing: bearingDeg(mouth.lat, mouth.lng, anchor.lat, anchor.lng),
      depthM: Math.min(dist, ALLEY_MAX_DEPTH_M),
    };
  }
  return {
    bearing: DEFAULT_ALLEY_BEARING,
    depthM: Math.min(house * ALLEY_HOUSE_SPACING_M, ALLEY_MAX_DEPTH_M),
  };
}

export function buildPickSession(
  field: ActiveField,
  query: string,
  picked: GeocodeResult,
  candidates: GeocodeResult[],
): PickSession {
  const mode = detectPickMode(query);
  const top = candidates.slice(0, 3);
  const alley = parseAlleyQuery(query);

  let anchor: Point = { lat: picked.lat, lng: picked.lng, name: picked.displayName };

  const session: PickSession = {
    field,
    mode,
    query,
    anchor,
    candidates: top.length ? top : [picked],
    haloRadiusM: HALO_HINT_RADIUS_M,
  };

  if (mode === "alley" && alley) {
    anchor = resolveAlleyAnchor(alley, query, picked, top.length ? top : [picked]);
    session.anchor = anchor;

    const mouth = resolveAlleyMouth(alley, anchor, picked, top.length ? top : [picked]);
    const { bearing, depthM } = alleyBearingAndDepth(mouth, anchor, alley.house);
    session.alley = {
      chain: alley.chain,
      house: alley.house,
      street: alley.street,
      mouth,
      bearing,
      depthM,
    };
  }

  return session;
}

export function alleyPointAtDepth(alley: AlleyPickState, depthM: number): Point {
  const p = pointAlongBearing(alley.mouth, alley.bearing, depthM);
  return { ...p, name: alley.mouth.name };
}

export function initialDraftPoint(session: PickSession): Point {
  if (session.alley) return { ...session.anchor };
  return { ...session.anchor };
}
