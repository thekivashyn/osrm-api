export type RoutingProfile = "driving" | "motorbike";

export interface Point {
  lat: number;
  lng: number;
  name?: string;
}

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
  distanceKm?: number | null;
}

export interface GeoJsonLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RouteOption {
  index: number;
  recommended: boolean;
  distance: number;
  durationOsrm: number | null;
  duration: number | null;
  geometry: GeoJsonLineString | null;
  summary: string;
}

export interface RouteData {
  profile: RoutingProfile;
  routes: RouteOption[];
  durationMeta: { available: boolean; profile: RoutingProfile; trafficFactor: number };
  distance: number;
  duration: number | null;
}

export interface ApiOk<T> {
  success: true;
  data: T;
}

export interface ApiErr {
  success: false;
  message: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export interface StatusResponse {
  success: boolean;
  osrm?: string;
  nominatim?: string;
  service?: string;
  message?: string;
}

export type ServiceProbeStatus = "ok" | "error" | "down" | "unreachable";

export interface SystemStatusData {
  api: { status: "ok"; service: string; version: string };
  osrmCar: { status: ServiceProbeStatus; service: string; message?: string };
  osrmMotor: { status: ServiceProbeStatus; service: string; message?: string };
  nominatim: { status: "ok" | "down"; service: string; message?: string };
  checkedAt: string;
}

export interface HealthResponse {
  success: boolean;
  service: string;
  status: string;
}

export interface InfoResponse {
  success: boolean;
  service: string;
  version: string;
}

export interface ClientIpData {
  ip: string;
  userAgent: string;
  timestamp: string;
  forwardedFor: string | null;
}

export interface RequestLogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  query: string | null;
  status: number;
  durationMs: number;
  clientIp: string;
  userAgent: string;
  forwardedFor: string | null;
  referer: string | null;
  host: string | null;
  protocol: string | null;
  requestContentLength: number | null;
  responseContentType: string | null;
}

export interface RequestLogsPage {
  total: number;
  limit: number;
  offset: number;
  maxStored: number;
  stored: number;
  items: RequestLogEntry[];
}

export interface RequestLogsQuery {
  limit?: number;
  offset?: number;
  status?: number;
  method?: string;
  path?: string;
  ip?: string;
  since?: string;
}
