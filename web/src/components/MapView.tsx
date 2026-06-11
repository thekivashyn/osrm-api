import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import type { Point, RouteOption } from "../types";
import "leaflet/dist/leaflet.css";

const iconFrom = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const iconTo = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#f43f5e;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

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
  useEffect(() => {
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
  }, [map, routes, from, to]);
  return null;
}

export function MapView({
  from,
  to,
  routes,
  activeIndex,
}: {
  from: Point;
  to: Point;
  routes: RouteOption[];
  activeIndex: number;
}) {
  return (
    <MapContainer center={[10.779, 106.688]} zoom={12} className="h-full w-full" zoomControl={false}>
      <MapResizeFix />
      <TileLayer
        attribution="&copy; OSM &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={20}
      />
      <Marker position={[from.lat, from.lng]} icon={iconFrom} />
      <Marker position={[to.lat, to.lng]} icon={iconTo} />
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
      {routes.length > 0 && <FitBounds routes={routes} from={from} to={to} />}
    </MapContainer>
  );
}
