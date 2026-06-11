import { GeoJSON, useMap } from "react-leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PathOptions } from "leaflet";
import { polygonCentroid } from "../lib/geo";

const MIN_ZOOM = 16;
const MAX_BBOX_DEG = 0.012;
const DEBOUNCE_MS = 350;

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
  }>;
};

const defaultStyle: PathOptions = {
  color: "#e2e8f0",
  weight: 1.5,
  opacity: 0.85,
  fillColor: "#94a3b8",
  fillOpacity: 0.35,
};

const pickStyle: PathOptions = {
  color: "#38bdf8",
  weight: 2,
  opacity: 0.95,
  fillColor: "#0ea5e9",
  fillOpacity: 0.45,
};

const pickHoverStyle: PathOptions = {
  color: "#7dd3fc",
  weight: 2.5,
  opacity: 1,
  fillColor: "#38bdf8",
  fillOpacity: 0.55,
};

async function loadBuildings(bounds: {
  south: number;
  west: number;
  north: number;
  east: number;
}): Promise<FeatureCollection> {
  const params = new URLSearchParams({
    south: String(bounds.south),
    west: String(bounds.west),
    north: String(bounds.north),
    east: String(bounds.east),
  });
  const res = await fetch(`/api/map/buildings?${params}`);
  const body = (await res.json()) as {
    success: boolean;
    data?: FeatureCollection;
  };
  if (!body.success || !body.data) return { type: "FeatureCollection", features: [] };
  return body.data;
}

export function BuildingFootprintLayer({
  pickMode = false,
  onBuildingPick,
}: {
  pickMode?: boolean;
  onBuildingPick?: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const zoom = map.getZoom();
      if (zoom < MIN_ZOOM) {
        setGeojson(null);
        return;
      }
      const b = map.getBounds();
      const c = map.getCenter();
      let south = b.getSouth();
      let north = b.getNorth();
      let west = b.getWest();
      let east = b.getEast();
      if (north - south > MAX_BBOX_DEG || east - west > MAX_BBOX_DEG) {
        const half = MAX_BBOX_DEG / 2;
        south = c.lat - half;
        north = c.lat + half;
        west = c.lng - half;
        east = c.lng + half;
      }
      const id = ++reqId.current;
      try {
        const data = await loadBuildings({ south, west, north, east });
        if (id === reqId.current) setGeojson(data);
      } catch {
        if (id === reqId.current) setGeojson(null);
      }
    }, DEBOUNCE_MS);
  }, [map]);

  useEffect(() => {
    refresh();
    map.on("moveend", refresh);
    map.on("zoomend", refresh);
    return () => {
      map.off("moveend", refresh);
      map.off("zoomend", refresh);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [map, refresh]);

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Geometry>, layer: L.Layer) => {
      if (!pickMode || !onBuildingPick) return;
      layer.on({
        mouseover: (e) => {
          const target = e.target as L.Path;
          target.setStyle(pickHoverStyle);
        },
        mouseout: (e) => {
          const target = e.target as L.Path;
          target.setStyle(pickStyle);
        },
        click: (e) => {
          const ll = e.latlng;
          const c = polygonCentroid(feature.geometry?.coordinates);
          onBuildingPick(c?.lat ?? ll.lat, c?.lng ?? ll.lng);
        },
      });
    },
    [pickMode, onBuildingPick],
  );

  return (
    <>
      {geojson?.features.length ? (
        <GeoJSON
          key={`${pickMode ? "pick" : "view"}-${geojson.features.length}-${geojson.features[0]?.properties?.id ?? 0}`}
          data={geojson}
          style={pickMode ? pickStyle : defaultStyle}
          interactive={pickMode}
          pane="overlayPane"
          onEachFeature={pickMode ? onEachFeature : undefined}
        />
      ) : null}
    </>
  );
}
