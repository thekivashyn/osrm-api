import { useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Point } from "../../types";

const PICK_FOCUS_ZOOM = 18;

/** Fly tight to the picked suggest lat/lng (not bounds center of all candidates). */
export function MapPickFlyTo({ target }: { target: Point }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    const key = `${target.lat.toFixed(6)},${target.lng.toFixed(6)}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), PICK_FOCUS_ZOOM), {
      duration: 0.75,
    });
  }, [map, target.lat, target.lng]);
  return null;
}

/** Report map center while user pans (crosshair placement). */
export function MapCenterTracker({
  onCenter,
  centerRef,
}: {
  onCenter: (lat: number, lng: number) => void;
  centerRef?: MutableRefObject<{ lat: number; lng: number } | null>;
}) {
  const map = useMap();
  useEffect(() => {
    const emit = () => {
      const c = map.getCenter();
      if (centerRef) centerRef.current = { lat: c.lat, lng: c.lng };
      onCenter(c.lat, c.lng);
    };
    emit();
    map.on("move", emit);
    map.on("moveend", emit);
    map.on("zoomend", emit);
    return () => {
      map.off("move", emit);
      map.off("moveend", emit);
      map.off("zoomend", emit);
    };
  }, [map, onCenter, centerRef]);
  return null;
}

/** Leaflet map instance for synchronous getCenter() at pin drop. */
export function MapInstanceBridge({ mapRef }: { mapRef: MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);
  return null;
}
