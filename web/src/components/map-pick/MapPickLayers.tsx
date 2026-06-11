import { Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import type { Point } from "../../types";
import { labeledPinIcon } from "../../lib/labeled-pin";
import type { ActiveField, AlleyPickState, PickSession } from "../../lib/pick-mode";
import { MapPickFlyTo } from "./MapPickHelpers";

const mouthIcon = L.divIcon({
  className: "",
  html: `<div class="alley-mouth-pin">Cổng hẻm</div>`,
  iconSize: [72, 24],
  iconAnchor: [36, 12],
});

function MapPickCursor() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.classList.add("map-pick-crosshair");
    return () => el.classList.remove("map-pick-crosshair");
  }, [map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function PlacedPin({
  point,
  field,
  label,
}: {
  point: Point;
  field: ActiveField;
  label?: string | null;
}) {
  const text = point.name?.trim() || label?.trim() || null;
  return (
    <Marker
      position={[point.lat, point.lng]}
      icon={labeledPinIcon(field, text)}
      zIndexOffset={650}
      interactive={false}
    />
  );
}

function AlleyMouthMarker({ alley }: { alley: AlleyPickState }) {
  return (
    <Marker
      position={[alley.mouth.lat, alley.mouth.lng]}
      icon={mouthIcon}
      zIndexOffset={500}
      interactive={false}
    />
  );
}

function AlleyDepthLine({ alley, draft }: { alley: AlleyPickState; draft: Point }) {
  const mouthPos: [number, number] = [alley.mouth.lat, alley.mouth.lng];
  const draftPos: [number, number] = [draft.lat, draft.lng];
  return (
    <Polyline
      positions={[mouthPos, draftPos]}
      pathOptions={{
        color: "#fbbf24",
        weight: 3,
        opacity: 0.85,
        dashArray: "8 10",
        lineCap: "round",
      }}
    />
  );
}

export function MapPickLayers({
  session,
  draftPoint,
  pickLocked,
  pickLabel,
  onMapClick,
}: {
  session: PickSession;
  draftPoint: Point;
  pickLocked: boolean;
  pickLabel?: string | null;
  onMapClick: (lat: number, lng: number) => void;
}) {
  return (
    <>
      <MapPickCursor />
      <MapPickFlyTo target={session.anchor} />
      <MapClickHandler onMapClick={onMapClick} />
      {pickLocked && <PlacedPin point={draftPoint} field={session.field} label={pickLabel} />}
      {session.alley && (
        <>
          <AlleyMouthMarker alley={session.alley} />
          {pickLocked && <AlleyDepthLine alley={session.alley} draft={draftPoint} />}
        </>
      )}
    </>
  );
}
