import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const FALLBACK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const FALLBACK_ATTRIBUTION = "&copy; OSM &copy; CARTO";

// The OFM dark style prefers name_en, which anglicizes VN labels
// ("Hẻm 258..." -> "Alley 258..."). Vietnamese is Latin-script so the
// name:nonlatin branch never applies here.
const LOCAL_NAME: ExpressionSpecification = ["coalesce", ["get", "name:vi"], ["get", "name"]];

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

type StyleJson = StyleSpecification & {
  layers: Array<{ type: string; layout?: Record<string, unknown> }>;
};

async function loadLocalizedStyle(signal: AbortSignal): Promise<StyleSpecification> {
  const res = await fetch(STYLE_URL, { signal });
  if (!res.ok) throw new Error(`Basemap style fetch failed: HTTP ${res.status}`);
  const style = (await res.json()) as StyleJson;
  for (const layer of style.layers) {
    const textField = layer.layout?.["text-field"];
    if (layer.type === "symbol" && textField && JSON.stringify(textField).includes("name")) {
      layer.layout!["text-field"] = LOCAL_NAME;
    }
  }
  return style;
}

/**
 * OpenFreeMap vector basemap rendered by maplibre-gl inside Leaflet's tile
 * pane, so Leaflet overlays (routes, footprints, markers) stack above it.
 * Attribution is gathered from the style's sources by the plugin itself
 * once the style loads.
 *
 * Falls back to raster tiles when WebGL is unavailable (maplibre throws
 * synchronously without it) or when the style can't be fetched — otherwise
 * the pane stays pure black (.leaflet-container background) with no signal.
 */
export function BasemapLayer() {
  const map = useMap();

  useEffect(() => {
    let layer: L.Layer | null = null;
    const controller = new AbortController();

    const addRasterFallback = () => {
      layer = L.tileLayer(FALLBACK_TILE_URL, {
        maxZoom: 20,
        attribution: FALLBACK_ATTRIBUTION,
      }).addTo(map);
    };

    if (!supportsWebGL()) {
      addRasterFallback();
    } else {
      loadLocalizedStyle(controller.signal)
        .then((style) => {
          if (controller.signal.aborted) return;
          layer = L.maplibreGL({ style }).addTo(map);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.error("OpenFreeMap basemap unavailable, using raster fallback:", err);
          addRasterFallback();
        });
    }

    return () => {
      controller.abort();
      layer?.remove();
    };
  }, [map]);

  return null;
}
