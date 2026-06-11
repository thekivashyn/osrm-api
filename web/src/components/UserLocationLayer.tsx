import { CircleMarker, Popup, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import type { Point } from "../types";

export function UserLocationLayer({ position }: { position: Point | null }) {
  if (!position) return null;
  return (
    <>
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={16}
        pathOptions={{
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
          color: "#3b82f6",
          weight: 1,
          opacity: 0.35,
          interactive: false,
        }}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={6}
        pathOptions={{
          fillColor: "#60a5fa",
          fillOpacity: 0.95,
          color: "#ffffff",
          weight: 2,
        }}
      >
        <Popup>
          <span className="text-xs font-medium text-neutral-900">Vị trí của bạn</span>
          <br />
          <span className="text-[10px] text-neutral-600">Search ưu tiên gần đây</span>
        </Popup>
      </CircleMarker>
    </>
  );
}

/** Fly to GPS once on first fix (auto-locate on load). */
export function UserLocationFlyTo({
  position,
  enabled,
}: {
  position: Point | null;
  enabled: boolean;
}) {
  const map = useMap();
  const flew = useRef(false);
  useEffect(() => {
    if (!enabled || !position || flew.current) return;
    flew.current = true;
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 13), { animate: true });
  }, [enabled, map, position]);
  return null;
}

/** Fly map to a point (manual locate). */
export function flyToPoint(map: LeafletMap, point: Point, minZoom = 14): void {
  map.setView([point.lat, point.lng], Math.max(map.getZoom(), minZoom), { animate: true });
}
