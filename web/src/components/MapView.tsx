import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { Point, RouteOption } from "../types";
import { BasemapLayer } from "./BasemapLayer";
import { BuildingFootprintLayer } from "./BuildingFootprintLayer";
import { MapFocus } from "./MapFocus";
import { MapPickLayers } from "./map-pick/MapPickLayers";
import { MapCenterTracker, MapInstanceBridge } from "./map-pick/MapPickHelpers";
import { UserLocationFlyTo, UserLocationLayer } from "./UserLocationLayer";
import { labeledPinIcon } from "../lib/labeled-pin";
import type { PickSession } from "../lib/pick-mode";
import "leaflet/dist/leaflet.css";

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const t = window.setTimeout(fix, 100);
    window.addEventListener("resize", fix);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

function FitBounds({ routes, from, to }: { routes: RouteOption[]; from: Point; to: Point }) {
  const map = useMap();
  const endpoints = useRef({ from, to });
  endpoints.current = { from, to };
  useEffect(() => {
    const { from, to } = endpoints.current;
    const coords: [number, number][] = [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ];
    for (const r of routes) {
      r.geometry?.coordinates.forEach(([lng, lat]) => coords.push([lat, lng]));
    }
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [48, 48], maxZoom: 15 });
    }
  }, [map, routes]);
  return null;
}

export function MapView({
  from,
  to,
  routes,
  activeIndex,
  focusPoint,
  pickSession,
  draftPoint,
  pickLocked = false,
  pickLabel,
  ghostRoute,
  onMapPick,
  onBuildingPick,
  onMapCenterChange,
  mapCenterRef,
  leafletMapRef,
  userLocation,
  flyToUserOnLoad = false,
}: {
  from: Point | null;
  to: Point | null;
  routes: RouteOption[];
  activeIndex: number;
  focusPoint?: Point | null;
  pickSession?: PickSession | null;
  draftPoint?: Point | null;
  pickLocked?: boolean;
  pickLabel?: string | null;
  ghostRoute?: RouteOption | null;
  onMapPick?: (lat: number, lng: number) => void;
  onBuildingPick?: (lat: number, lng: number) => void;
  onMapCenterChange?: (lat: number, lng: number) => void;
  mapCenterRef?: MutableRefObject<{ lat: number; lng: number } | null>;
  leafletMapRef?: MutableRefObject<L.Map | null>;
  userLocation?: Point | null;
  flyToUserOnLoad?: boolean;
}) {
  const picking = Boolean(pickSession);
  const pickDraft = draftPoint ?? pickSession?.anchor ?? null;
  const buildingAssist = Boolean(pickSession);

  return (
    <MapContainer
      center={[10.779, 106.688]}
      zoom={12}
      minZoom={2}
      maxZoom={20}
      className="h-full w-full"
      zoomControl={false}
    >
      <MapResizeFix />
      <BasemapLayer />
      <UserLocationLayer position={userLocation ?? null} />
      {flyToUserOnLoad && userLocation && <UserLocationFlyTo position={userLocation} enabled />}
      {leafletMapRef && <MapInstanceBridge mapRef={leafletMapRef} />}
      {onMapCenterChange && (
        <MapCenterTracker onCenter={onMapCenterChange} centerRef={mapCenterRef} />
      )}
      <BuildingFootprintLayer pickMode={buildingAssist} onBuildingPick={onBuildingPick} />
      {!picking && focusPoint && <MapFocus point={focusPoint} />}
      {!pickSession && from && (
        <Marker position={[from.lat, from.lng]} icon={labeledPinIcon("from", from.name)} />
      )}
      {!pickSession && to && (
        <Marker position={[to.lat, to.lng]} icon={labeledPinIcon("to", to.name)} />
      )}
      {picking && pickSession && pickDraft && onMapPick && (
        <MapPickLayers
          session={pickSession}
          draftPoint={pickDraft}
          pickLocked={pickLocked}
          pickLabel={pickLabel}
          onMapClick={onMapPick}
        />
      )}
      {ghostRoute?.geometry?.coordinates.length ? (
        <Polyline
          positions={ghostRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
          pathOptions={{
            color: "#a78bfa",
            weight: 4,
            opacity: 0.65,
            dashArray: "10 14",
            lineCap: "round",
            className: "ghost-route-line",
          }}
        />
      ) : null}
      {routes.map((r, i) => {
        if (!r.geometry?.coordinates.length) return null;
        const latlngs = r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
        const active = i === activeIndex;
        return (
          <Polyline
            key={r.index}
            positions={latlngs}
            pathOptions={{
              color: active ? "#10b981" : "#64748b",
              weight: active ? 5 : 3,
              opacity: active ? 0.95 : 0.55,
              lineCap: "round",
              lineJoin: "round",
            }}
            className={active ? "route-polyline-active" : "route-polyline-alt"}
          />
        );
      })}
      {routes.length > 0 && !pickSession && from && to && (
        <FitBounds routes={routes} from={from} to={to} />
      )}
    </MapContainer>
  );
}
