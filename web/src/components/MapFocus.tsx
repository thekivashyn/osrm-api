import { useMap } from "react-leaflet";
import { useEffect } from "react";
import type { Point } from "../types";

/** Fly to a picked address so building footprints (z≥15) become visible. */
export function MapFocus({ point }: { point: Point | null }) {
  const map = useMap();
  // Depend on object identity (a fresh object per pick) so re-picking the
  // same address after panning away still re-focuses.
  useEffect(() => {
    if (!point) return;
    map.setView([point.lat, point.lng], Math.max(map.getZoom(), 18), { animate: true });
  }, [map, point]);
  return null;
}
