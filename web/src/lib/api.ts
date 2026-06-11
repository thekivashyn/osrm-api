import type {
  ApiResponse,
  ClientIpData,
  GeocodeResult,
  HealthResponse,
  InfoResponse,
  NearestData,
  Point,
  RequestLogEntry,
  RequestLogsPage,
  RequestLogsQuery,
  RouteData,
  RoutingProfile,
  StatusResponse,
  SystemStatusData,
} from "../types";

async function parseJson<T>(res: Response): Promise<ApiResponse<T>> {
  return res.json() as Promise<ApiResponse<T>>;
}

export async function fetchGeocode(
  q: string,
  bias: Point,
  limit = 6,
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
    lat: String(bias.lat),
    lng: String(bias.lng),
  });
  const res = await fetch(`/api/geocode?${params}`);
  const data = await parseJson<{ results: GeocodeResult[] }>(res);
  if (res.status === 429) {
    throw new Error("Rate limit — đợi ~60 giây rồi thử lại");
  }
  if (!data.success) throw new Error(data.message);
  return data.data.results;
}

export async function fetchReverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const res = await fetch(`/api/reverse-geocode?${params}`);
  const data = await parseJson<GeocodeResult>(res);
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function fetchNearest(lat: number, lng: number): Promise<Point> {
  const res = await fetch("/api/nearest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  const data = await parseJson<NearestData>(res);
  if (!data.success) throw new Error(data.message);
  const [lngSnapped, latSnapped] = data.data.waypoint.location;
  return { lat: latSnapped, lng: lngSnapped, name: data.data.waypoint.name };
}

export async function fetchRoute(
  from: Point,
  to: Point,
  profile: RoutingProfile,
  alternatives: boolean,
): Promise<RouteData> {
  const res = await fetch("/api/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: { lat: from.lat, lng: from.lng },
      to: { lat: to.lat, lng: to.lng },
      profile,
      alternatives,
    }),
  });
  const data = await parseJson<RouteData>(res);
  if (!data.success) throw new Error(data.message);
  return data.data;
}

export async function fetchOsrmStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/osrm-status");
  return res.json() as Promise<StatusResponse>;
}

export async function fetchOsrmMotorStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/osrm-motor-status");
  return res.json() as Promise<StatusResponse>;
}

export async function fetchGeocodeStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/geocode-status");
  return res.json() as Promise<StatusResponse>;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/health");
  return res.json() as Promise<HealthResponse>;
}

export async function fetchInfo(): Promise<InfoResponse> {
  const res = await fetch("/api/info");
  return res.json() as Promise<InfoResponse>;
}

function mapOsrmProbe(res: StatusResponse, service: string): SystemStatusData["osrmCar"] {
  if (res.success && res.osrm === "ok") {
    return { status: "ok", service };
  }
  const status =
    res.osrm === "down" ? "down" : res.osrm === "unreachable" ? "unreachable" : "error";
  return { status, service, message: res.message };
}

/** Public probes only — không dùng /api/system-status (server-local). */
export async function fetchMonitorSnapshot(): Promise<SystemStatusData> {
  const [health, info, osrmCar, osrmMotor, geocode] = await Promise.all([
    fetchHealth(),
    fetchInfo(),
    fetchOsrmStatus(),
    fetchOsrmMotorStatus(),
    fetchGeocodeStatus(),
  ]);
  if (!health.success) throw new Error("health check failed");

  return {
    api: {
      status: "ok",
      service: health.service,
      version: info.version,
    },
    osrmCar: mapOsrmProbe(osrmCar, "osrm-car"),
    osrmMotor: mapOsrmProbe(osrmMotor, "osrm-motor"),
    pelias: {
      status: geocode.success && geocode.pelias === "ok" ? "ok" : "down",
      service: "pelias",
      message: geocode.message,
    },
    checkedAt: new Date().toISOString(),
  };
}

export async function fetchClientIpDetails(): Promise<ClientIpData> {
  const res = await fetch("/api/client-ip");
  const data = (await res.json()) as ApiResponse<ClientIpData>;
  if (!data.success) throw new Error("client-ip failed");
  return data.data;
}

function buildLogsQuery(params: RequestLogsQuery): string {
  const q = new URLSearchParams();
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  if (params.status != null) q.set("status", String(params.status));
  if (params.method) q.set("method", params.method);
  if (params.path) q.set("path", params.path);
  if (params.ip) q.set("ip", params.ip);
  if (params.since) q.set("since", params.since);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchRequestLogs(query: RequestLogsQuery = {}): Promise<RequestLogsPage> {
  const res = await fetch(`/api/request-logs${buildLogsQuery(query)}`);
  const data = (await res.json()) as ApiResponse<RequestLogsPage>;
  if (!data.success) throw new Error("request-logs failed");
  return data.data;
}

export async function fetchRequestLogById(id: string): Promise<RequestLogEntry> {
  const res = await fetch(`/api/request-logs/${encodeURIComponent(id)}`);
  const data = (await res.json()) as ApiResponse<RequestLogEntry>;
  if (!data.success) throw new Error("request-log not found");
  return data.data;
}
