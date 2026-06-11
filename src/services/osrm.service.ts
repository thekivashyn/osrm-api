import { config } from "../config/env";
import { OsrmError } from "../utils/response";
import { TtlCache } from "../utils/ttl-cache";
import type {
  Coordinate,
  MatchData,
  NearestData,
  OsrmMatchResponse,
  OsrmNearestResponse,
  OsrmRouteResponse,
  OsrmTableResponse,
  RouteData,
  RouteOption,
  RoutingProfile,
  TableData,
} from "../types";
import { toOsrmCoordinateString } from "../utils/validation";

const MAX_ROUTE_OPTIONS = 4;
const OSRM_NATIVE_ALTERNATIVES = 3;
const routeCache = new TtlCache<RouteData>(config.routeCacheTtlMs);

/** @internal test helper */
export function clearRouteCache(): void {
  routeCache.clear();
}

function routeCacheKey(
  from: Coordinate,
  to: Coordinate,
  profile: RoutingProfile,
  alternatives: boolean,
): string {
  const r = (n: number) => n.toFixed(5);
  return `${profile}:${alternatives}:${r(from.lat)},${r(from.lng)}:${r(to.lat)},${r(to.lng)}`;
}

function osrmBaseUrlForProfile(profile: RoutingProfile): string {
  return profile === "motorbike" ? config.osrmMotorUrl : config.osrmUrl;
}

type OsrmRawRoute = OsrmRouteResponse["routes"][number];

function routeMetrics(route: OsrmRawRoute): { distance: number; duration: number } {
  if (route.legs?.length) {
    return {
      distance: route.legs.reduce((sum, leg) => sum + leg.distance, 0),
      duration: route.legs.reduce((sum, leg) => sum + leg.duration, 0),
    };
  }

  return { distance: route.distance, duration: route.duration };
}

function routesAreSimilar(a: OsrmRawRoute, b: OsrmRawRoute): boolean {
  const ma = routeMetrics(a);
  const mb = routeMetrics(b);
  const distanceDelta = Math.abs(ma.distance - mb.distance) / Math.max(ma.distance, 1);
  const durationDelta = Math.abs(ma.duration - mb.duration) / Math.max(ma.duration, 1);
  return distanceDelta < 0.07 && durationDelta < 0.07;
}

function isValidDuration(seconds: unknown): seconds is number {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0;
}

function toOsrmEngineProfile(_profile: RoutingProfile): string {
  return "driving";
}

function durationFactorForProfile(profile: RoutingProfile): number {
  return profile === "motorbike" ? config.motorbikeDurationFactor : config.carDurationFactor;
}

function applyDurationFactor(seconds: number | null, factor: number): number | null {
  if (!isValidDuration(seconds)) {
    return null;
  }
  const adjusted = seconds * factor;
  return factor === 1 ? adjusted : Math.round(adjusted);
}

function toRouteOption(
  route: OsrmRawRoute,
  index: number,
  recommended: boolean,
  trafficFactor: number,
): RouteOption {
  const { distance, duration: durationRaw } = routeMetrics(route);
  const durationOsrm = isValidDuration(durationRaw) ? durationRaw : null;
  const summary =
    route.legs.map((leg) => leg.summary).filter(Boolean).join(" → ") || `Route ${index + 1}`;

  return {
    index,
    recommended,
    distance,
    durationOsrm,
    duration: applyDurationFactor(durationOsrm, trafficFactor),
    geometry: route.geometry,
    legs: route.legs,
    weight: route.weight,
    summary,
  };
}

function mergeRouteCandidates(primary: OsrmRawRoute[], extra: OsrmRawRoute[]): OsrmRawRoute[] {
  const merged = [...primary];

  for (const candidate of extra) {
    if (merged.some((existing) => routesAreSimilar(existing, candidate))) {
      continue;
    }
    merged.push(candidate);
    if (merged.length >= MAX_ROUTE_OPTIONS) {
      break;
    }
  }

  return merged
    .sort((a, b) => routeMetrics(a).duration - routeMetrics(b).duration)
    .slice(0, MAX_ROUTE_OPTIONS);
}

export class OsrmService {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async fetch<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new OsrmError("Unable to reach OSRM service");
    }

    let data: (T & { code?: string; message?: string }) | null = null;
    let raw = "";
    try {
      raw = await response.text();
      data = raw ? (JSON.parse(raw) as T & { code?: string; message?: string }) : null;
    } catch {
      throw new OsrmError(
        `OSRM at ${this.baseUrl} returned HTTP ${response.status} (not valid JSON). ` +
          `On macOS, port 5000 is often AirPlay — set OSRM_URL=http://localhost:5050 and run: docker compose up osrm -d`,
      );
    }

    if (!data || typeof data !== "object") {
      throw new OsrmError(
        `Empty response from OSRM at ${this.baseUrl} (HTTP ${response.status})`,
      );
    }

    if (!response.ok) {
      throw new OsrmError(data.message ?? `OSRM request failed with HTTP ${response.status}`);
    }

    if (data.code && data.code !== "Ok") {
      throw new OsrmError(data.message ?? `OSRM returned code: ${data.code}`);
    }

    return data;
  }

  private async fetchRouteRaw(
    profile: RoutingProfile,
    coordinates: Coordinate[],
    options: { alternatives?: boolean; steps?: boolean } = {},
  ): Promise<OsrmRouteResponse> {
    const params = new URLSearchParams({
      overview: "full",
      steps: String(options.steps ?? true),
      geometries: "geojson",
      annotations: "duration,distance",
    });

    if (options.alternatives) {
      params.set("alternatives", String(OSRM_NATIVE_ALTERNATIVES));
    }

    const coordPath = toOsrmCoordinateString(coordinates);
    const engine = toOsrmEngineProfile(profile);
    return this.fetch<OsrmRouteResponse>(`/route/v1/${engine}/${coordPath}?${params.toString()}`);
  }

  private corridorViaPoints(from: Coordinate, to: Coordinate): Coordinate[] {
    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;
    const dLat = to.lat - from.lat;
    const dLng = to.lng - from.lng;
    const length = Math.hypot(dLat, dLng) || 1;
    const offset = 0.028;

    return [
      { lat: midLat + (-dLng / length) * offset, lng: midLng + (dLat / length) * offset },
      { lat: midLat - (-dLng / length) * offset, lng: midLng - (dLat / length) * offset },
    ];
  }

  private async fetchCorridorAlternatives(
    from: Coordinate,
    to: Coordinate,
    profile: RoutingProfile,
  ): Promise<OsrmRawRoute[]> {
    const extras: OsrmRawRoute[] = [];

    for (const via of this.corridorViaPoints(from, to)) {
      try {
        const data = await this.fetchRouteRaw(profile, [from, via, to], { steps: false });
        const route = data.routes[0];
        if (route) {
          extras.push(route);
        }
      } catch {
        // Some corridor waypoints may not produce a valid route — skip silently.
      }
    }

    return extras;
  }

  async route(
    from: Coordinate,
    to: Coordinate,
    options: { profile?: RoutingProfile; alternatives?: boolean } = {},
  ): Promise<RouteData> {
    const profile = options.profile ?? "driving";
    const wantAlternatives = options.alternatives !== false;
    const cacheKey = routeCacheKey(from, to, profile, wantAlternatives);
    const cached = routeCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await this.fetchRouteRaw(profile, [from, to], {
      alternatives: wantAlternatives,
    });

    if (!data.routes.length) {
      throw new OsrmError("No route found between the given points");
    }

    let rawRoutes = data.routes;

    if (wantAlternatives && rawRoutes.length < MAX_ROUTE_OPTIONS) {
      const corridorRoutes = await this.fetchCorridorAlternatives(from, to, profile);
      rawRoutes = mergeRouteCandidates(rawRoutes, corridorRoutes);
    }

    const trafficFactor = durationFactorForProfile(profile);
    const routes = rawRoutes.map((route, index) =>
      toRouteOption(route, index, index === 0, trafficFactor),
    );
    const primary = routes[0]!;
    const durationAvailable = isValidDuration(primary.durationOsrm);

    const result: RouteData = {
      profile,
      routes,
      durationMeta: {
        available: durationAvailable,
        profile,
        trafficFactor,
        source: "osrm_static",
      },
      distance: primary.distance,
      duration: durationAvailable ? primary.duration : null,
      durationOsrm: durationAvailable ? primary.durationOsrm : null,
      geometry: primary.geometry,
      legs: primary.legs,
      weight: primary.weight,
      summary: primary.summary,
    };

    routeCache.set(cacheKey, result);
    return result;
  }

  async table(sources: Coordinate[], destinations: Coordinate[]): Promise<TableData> {
    const allPoints = [...sources, ...destinations];
    const coordinates = toOsrmCoordinateString(allPoints);

    const sourceIndices = sources.map((_, i) => i).join(";");
    const destIndices = destinations.map((_, i) => i + sources.length).join(";");

    const params = new URLSearchParams({
      sources: sourceIndices,
      destinations: destIndices,
      annotations: "distance,duration",
    });

    const data = await this.fetch<OsrmTableResponse>(
      `/table/v1/driving/${coordinates}?${params.toString()}`,
    );

    return {
      distances: data.distances,
      durations: data.durations,
      sources: data.sources,
      destinations: data.destinations,
    };
  }

  async nearest(coord: Coordinate): Promise<NearestData> {
    const coordinates = toOsrmCoordinateString([coord]);

    const data = await this.fetch<OsrmNearestResponse>(
      `/nearest/v1/driving/${coordinates}?number=1`,
    );

    const waypoint = data.waypoints[0];
    if (!waypoint) {
      throw new OsrmError("No nearest road found for the given point");
    }

    return {
      waypoint,
      nodes: data.nodes,
    };
  }

  async match(points: Coordinate[]): Promise<MatchData> {
    const coordinates = toOsrmCoordinateString(points);
    const params = new URLSearchParams({
      geometries: "geojson",
      overview: "full",
      steps: "true",
    });

    const data = await this.fetch<OsrmMatchResponse>(
      `/match/v1/driving/${coordinates}?${params.toString()}`,
    );

    return {
      matchings: data.matchings,
      tracepoints: data.tracepoints,
    };
  }
}

export const osrmService = {
  route: (
    from: Coordinate,
    to: Coordinate,
    options?: { profile?: RoutingProfile; alternatives?: boolean },
  ) => {
    const profile = options?.profile ?? "driving";
    return new OsrmService(osrmBaseUrlForProfile(profile)).route(from, to, options);
  },
  table: (sources: Coordinate[], destinations: Coordinate[]) =>
    new OsrmService(config.osrmUrl).table(sources, destinations),
  nearest: (coord: Coordinate) => new OsrmService(config.osrmUrl).nearest(coord),
  match: (points: Coordinate[]) => new OsrmService(config.osrmUrl).match(points),
};
