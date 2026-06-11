import type { Coordinate, RoutingProfile } from "../types";
import { AppError } from "./response";

const ROUTING_PROFILES: RoutingProfile[] = ["driving", "motorbike"];

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

export function validateLat(lat: unknown): lat is number {
  return typeof lat === "number" && !Number.isNaN(lat) && lat >= LAT_MIN && lat <= LAT_MAX;
}

export function validateLng(lng: unknown): lng is number {
  return typeof lng === "number" && !Number.isNaN(lng) && lng >= LNG_MIN && lng <= LNG_MAX;
}

export function validateCoordinate(coord: unknown, label = "coordinate"): Coordinate {
  if (!coord || typeof coord !== "object") {
    throw new AppError(`Invalid ${label}: must be an object with lat and lng`);
  }

  const { lat, lng } = coord as Record<string, unknown>;

  if (!validateLat(lat)) {
    throw new AppError(`Invalid ${label}.lat: must be a number between ${LAT_MIN} and ${LAT_MAX}`);
  }

  if (!validateLng(lng)) {
    throw new AppError(`Invalid ${label}.lng: must be a number between ${LNG_MIN} and ${LNG_MAX}`);
  }

  return { lat, lng };
}

export function validateCoordinates(
  coords: unknown,
  label: string,
  minCount = 1,
): Coordinate[] {
  if (!Array.isArray(coords)) {
    throw new AppError(`Invalid ${label}: must be an array`);
  }

  if (coords.length < minCount) {
    throw new AppError(`Invalid ${label}: must contain at least ${minCount} point(s)`);
  }

  return coords.map((coord, index) => validateCoordinate(coord, `${label}[${index}]`));
}

export function validateRoutingProfile(profile: unknown): RoutingProfile {
  if (profile === undefined || profile === null) {
    return "driving";
  }
  if (typeof profile !== "string" || !ROUTING_PROFILES.includes(profile as RoutingProfile)) {
    throw new AppError(`Invalid profile: must be one of ${ROUTING_PROFILES.join(", ")}`);
  }
  return profile as RoutingProfile;
}

export function toOsrmCoordinate(coord: Coordinate): string {
  return `${coord.lng},${coord.lat}`;
}

export function toOsrmCoordinateString(coords: Coordinate[]): string {
  return coords.map(toOsrmCoordinate).join(";");
}
