export interface Coordinate {
  lat: number;
  lng: number;
}

export interface GeoJsonLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface RouteRequest {
  from: Coordinate;
  to: Coordinate;
  profile?: RoutingProfile;
  alternatives?: boolean;
}

export type RoutingProfile = "driving" | "motorbike";

export interface RouteOption {
  index: number;
  recommended: boolean;
  distance: number;
  /** OSRM static duration (seconds); null when unavailable */
  durationOsrm: number | null;
  /** durationOsrm × profile traffic factor; null when unavailable */
  duration: number | null;
  geometry: GeoJsonLineString | null;
  legs: OsrmLeg[];
  weight: number;
  summary: string;
}

export interface RouteDurationMeta {
  available: boolean;
  profile: RoutingProfile;
  trafficFactor: number;
  source: "osrm_static";
}

export interface RouteData {
  profile: RoutingProfile;
  routes: RouteOption[];
  durationMeta: RouteDurationMeta;
  distance: number;
  duration: number | null;
  durationOsrm: number | null;
  geometry: GeoJsonLineString | null;
  legs: OsrmLeg[];
  weight: number;
  summary: string;
}

export interface TableRequest {
  sources: Coordinate[];
  destinations: Coordinate[];
}

export interface TableData {
  distances: number[][];
  durations: number[][];
  sources: OsrmWaypoint[];
  destinations: OsrmWaypoint[];
}

export interface NearestRequest {
  lat: number;
  lng: number;
}

export interface NearestData {
  waypoint: OsrmWaypoint;
  nodes: number[];
}

export interface MatchRequest {
  points: Coordinate[];
}

export interface MatchData {
  matchings: OsrmMatching[];
  tracepoints: (OsrmWaypoint | null)[];
}

export interface TripRequest {
  points: Coordinate[];
  roundtrip?: boolean;
  source?: "first" | "any";
  destination?: "last" | "any";
}

export interface TripData {
  trips: OsrmTrip[];
  waypoints: OsrmWaypoint[];
}

export interface OsrmWaypoint {
  hint: string;
  distance: number;
  name: string;
  location: [number, number];
}

export interface OsrmLeg {
  distance: number;
  duration: number;
  weight: number;
  summary: string;
  steps?: OsrmStep[];
}

export interface OsrmStep {
  distance: number;
  duration: number;
  geometry: GeoJsonLineString;
  name: string;
  mode: string;
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
}

export interface OsrmMatching {
  distance: number;
  duration: number;
  weight: number;
  geometry: GeoJsonLineString;
  confidence: number;
  legs: OsrmLeg[];
}

export interface OsrmTrip {
  distance: number;
  duration: number;
  weight: number;
  geometry: GeoJsonLineString;
  legs: OsrmLeg[];
}

export interface OsrmRouteResponse {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    weight: number;
    geometry: GeoJsonLineString;
    legs: OsrmLeg[];
  }>;
  waypoints: OsrmWaypoint[];
  message?: string;
}

export interface OsrmTableResponse {
  code: string;
  distances: number[][];
  durations: number[][];
  sources: OsrmWaypoint[];
  destinations: OsrmWaypoint[];
  message?: string;
}

export interface OsrmNearestResponse {
  code: string;
  waypoints: OsrmWaypoint[];
  nodes: number[];
  message?: string;
}

export interface OsrmMatchResponse {
  code: string;
  matchings: OsrmMatching[];
  tracepoints: (OsrmWaypoint | null)[];
  message?: string;
}

export interface OsrmTripResponse {
  code: string;
  trips: OsrmTrip[];
  waypoints: OsrmWaypoint[];
  message?: string;
}
