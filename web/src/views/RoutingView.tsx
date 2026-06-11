import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapLocateButton } from "../components/MapLocateButton";
import { MapView } from "../components/MapView";
import { flyToPoint } from "../components/UserLocationLayer";
import { SearchField } from "../components/SearchField";
import { PickGuideOverlay } from "../components/map-pick/PickGuideOverlay";
import { useGhostRoute } from "../hooks/useGhostRoute";
import { useUserLocation } from "../hooks/useUserLocation";
import { fetchNearest, fetchReverseGeocode, fetchRoute } from "../lib/api";
import {
  MAP_DEFAULT_CENTER,
  DURATION_DISCLAIMER,
  fmtDist,
  fmtDur,
  PROFILE_LABELS,
} from "../lib/format";
import { resolveSearchBias } from "../lib/search-bias";
import {
  alleyQueryLabel,
  buildPickSession,
  parseAlleyQuery,
  type ActiveField,
  type PickSession,
} from "../lib/pick-mode";
import type { GeocodeResult, Point, RouteData, RouteOption, RoutingProfile } from "../types";
import type { Map as LeafletMap } from "leaflet";

function SwapIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export default function RoutingView({ osrm }: { osrm: "ok" | "down" | "loading" }) {
  const [from, setFrom] = useState<Point | null>(null);
  const [to, setTo] = useState<Point | null>(null);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [profile, setProfile] = useState<RoutingProfile>("driving");
  const [alternatives, setAlternatives] = useState(true);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<ActiveField>("to");
  const [pickSession, setPickSession] = useState<PickSession | null>(null);
  const [draftPoint, setDraftPoint] = useState<Point | null>(null);
  const [pickLocked, setPickLocked] = useState(false);
  const commitId = useRef(0);
  const mapCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const mapBiasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapCenter, setMapCenter] = useState<Point | null>(null);
  const { position: userGps, status: gpsStatus, request: requestGps } = useUserLocation(true);

  const fallbackBias = useMemo(() => {
    if (from && to) return { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
    if (from) return { lat: from.lat, lng: from.lng };
    if (to) return { lat: to.lat, lng: to.lng };
    return MAP_DEFAULT_CENTER;
  }, [from, to]);
  const searchBias = useMemo(
    () => resolveSearchBias(userGps, mapCenter, fallbackBias),
    [userGps, mapCenter, fallbackBias],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const clearRoute = useCallback(() => {
    setRoutes([]);
    setRouteData(null);
    setError(null);
  }, []);

  const commitPoint = useCallback(
    async (field: ActiveField, point: Point, snap: boolean, queryFallback: string) => {
      const dropLat = point.lat;
      const dropLng = point.lng;

      const applyCoords = (lat: number, lng: number, label?: string) => {
        const pt: Point = { lat, lng, name: label };
        if (field === "from") {
          setFrom(pt);
          if (label !== undefined) setFromQuery(label);
        } else {
          setTo(pt);
          if (label !== undefined) setToQuery(label);
        }
        setDraftPoint({ lat, lng });
        clearRoute();
      };

      // Source of truth: drop lat/lng — apply immediately so routing never uses stale geocode.
      applyCoords(dropLat, dropLng);

      const id = ++commitId.current;
      let lat = dropLat;
      let lng = dropLng;

      if (snap) {
        try {
          const snapped = await fetchNearest(dropLat, dropLng);
          if (id !== commitId.current) return;
          lat = snapped.lat;
          lng = snapped.lng;
          applyCoords(lat, lng);
        } catch {
          /* keep drop coords */
        }
      }

      try {
        const rev = await fetchReverseGeocode(lat, lng);
        if (id !== commitId.current) return;
        const alleyLabel = parseAlleyQuery(queryFallback);
        const label = alleyLabel
          ? alleyQueryLabel(queryFallback, alleyLabel)
          : `Gần ${rev.displayName}`;
        applyCoords(lat, lng, label);
      } catch {
        if (id === commitId.current) {
          const alleyLabel = parseAlleyQuery(queryFallback);
          applyCoords(
            lat,
            lng,
            alleyLabel ? alleyQueryLabel(queryFallback, alleyLabel) : queryFallback,
          );
        }
      }
    },
    [clearRoute],
  );

  const startPickSession = useCallback(
    (field: ActiveField, picked: GeocodeResult, candidates: GeocodeResult[], query: string) => {
      const session = buildPickSession(field, query, picked, candidates);
      setActiveField(field);
      setPickSession(session);
      setPickLocked(false);
      setDraftPoint(session.alley ? session.anchor : null);
      mapCenterRef.current = null;
    },
    [],
  );

  const startAdjustSession = useCallback(
    (field: ActiveField) => {
      const point = field === "from" ? from : to;
      const query = field === "from" ? fromQuery : toQuery;
      const anchor: GeocodeResult = point
        ? { displayName: point.name ?? query, lat: point.lat, lng: point.lng }
        : userGps
          ? { displayName: "Vị trí hiện tại", lat: userGps.lat, lng: userGps.lng }
          : mapCenterRef.current
            ? {
                displayName: query || "Chọn trên map",
                lat: mapCenterRef.current.lat,
                lng: mapCenterRef.current.lng,
              }
            : {
                displayName: query || "Chọn trên map",
                lat: MAP_DEFAULT_CENTER.lat,
                lng: MAP_DEFAULT_CENTER.lng,
              };
      clearRoute();
      setActiveField(field);
      const session = buildPickSession(field, query, anchor, [anchor]);
      setPickSession(session);
      setPickLocked(Boolean(point));
      setDraftPoint(
        point
          ? { lat: point.lat, lng: point.lng }
          : session.alley
            ? session.anchor
            : null,
      );
      mapCenterRef.current = null;
    },
    [from, to, fromQuery, toQuery, userGps, clearRoute],
  );

  const endPickSession = useCallback(() => {
    setPickSession(null);
    setDraftPoint(null);
    setPickLocked(false);
  }, []);

  useEffect(() => {
    if (!pickSession) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endPickSession();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickSession, endPickSession]);

  const finishPick = useCallback(
    (field: ActiveField, point: Point, queryFallback: string, snap = true) => {
      void commitPoint(field, point, snap, queryFallback);
      endPickSession();
    },
    [commitPoint, endPickSession],
  );

  const handleMapCenterChange = useCallback((lat: number, lng: number) => {
    mapCenterRef.current = { lat, lng };
    if (mapBiasTimer.current) clearTimeout(mapBiasTimer.current);
    mapBiasTimer.current = setTimeout(() => {
      setMapCenter({ lat, lng });
    }, 450);
  }, []);

  const handleLocate = useCallback(async () => {
    const pt = await requestGps();
    if (!pt) {
      showToast("Không lấy được GPS — kiểm tra quyền truy cập vị trí");
      return;
    }
    if (leafletMapRef.current) flyToPoint(leafletMapRef.current, pt);
    setMapCenter({ lat: pt.lat, lng: pt.lng });
    try {
      const rev = await fetchReverseGeocode(pt.lat, pt.lng);
      setFrom({ lat: pt.lat, lng: pt.lng, name: `Gần ${rev.displayName}` });
      setFromQuery(`Gần ${rev.displayName}`);
    } catch {
      setFrom({ lat: pt.lat, lng: pt.lng, name: `${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}` });
      setFromQuery(`${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`);
      showToast("Đã lấy GPS — không reverse được địa chỉ");
      return;
    }
    clearRoute();
  }, [requestGps, clearRoute]);

  const pickFrom = (r: GeocodeResult, meta: { query: string; results: GeocodeResult[] }) => {
    startPickSession("from", r, meta.results, meta.query);
  };

  const pickTo = (r: GeocodeResult, meta: { query: string; results: GeocodeResult[] }) => {
    startPickSession("to", r, meta.results, meta.query);
  };

  const swapPoints = () => {
    setFrom(to);
    setTo(from);
    setFromQuery(toQuery);
    setToQuery(fromQuery);
    endPickSession();
    clearRoute();
  };

  const handleMapPick = useCallback(
    (lat: number, lng: number) => {
      if (!pickSession) return;
      if (pickSession.alley) setPickLocked(true);
      finishPick(pickSession.field, { lat, lng }, pickSession.query);
    },
    [pickSession, finishPick],
  );

  const handleBuildingPick = useCallback(
    (lat: number, lng: number) => {
      if (!pickSession) return;
      finishPick(pickSession.field, { lat, lng, name: "Tòa nhà đã chọn" }, pickSession.query);
    },
    [pickSession, finishPick],
  );

  const ghostFrom = pickSession?.field === "from" && draftPoint ? draftPoint : from;
  const ghostTo = pickSession?.field === "to" && draftPoint ? draftPoint : to;
  const { ghostRoute } = useGhostRoute(ghostFrom, ghostTo, profile, Boolean(pickSession && from && to));

  const runRoute = useCallback(async () => {
    if (pickSession) endPickSession();

    if (!from || !to) {
      showToast("Chọn điểm đi và điểm đến");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchRoute(from, to, profile, alternatives);
      setRouteData(data);
      setRoutes(data.routes);
      setActiveIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Routing failed");
      setRoutes([]);
      setRouteData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, profile, alternatives, pickSession, endPickSession]);

  const activeRoute = routes[activeIndex];

  return (
    <div className="h-full w-full">
      <main className="relative h-full w-full">
        <div className="absolute inset-0">
          {loading && (
            <div className="absolute inset-0 z-[500] grid place-items-center bg-black/60 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-white" />
                <span className="text-xs text-neutral-500">Đang tính tuyến…</span>
              </div>
            </div>
          )}
          {pickSession && <PickGuideOverlay field={pickSession.field} />}
          <MapView
            from={from}
            to={to}
            routes={routes}
            activeIndex={activeIndex}
            pickSession={pickSession}
            draftPoint={draftPoint}
          pickLocked={pickLocked}
          pickLabel={pickSession?.field === "from" ? fromQuery : toQuery}
          ghostRoute={ghostRoute}
            onMapPick={handleMapPick}
            onBuildingPick={handleBuildingPick}
            onMapCenterChange={handleMapCenterChange}
            mapCenterRef={mapCenterRef}
            leafletMapRef={leafletMapRef}
            userLocation={userGps}
            flyToUserOnLoad
          />
          <div className="absolute bottom-4 right-3 z-[600] sm:right-4">
            <MapLocateButton
              onClick={() => void handleLocate()}
              loading={gpsStatus === "loading"}
              active={Boolean(userGps)}
            />
          </div>
        </div>

        <aside className="absolute left-3 top-3 z-[600] flex max-h-[calc(100vh-7rem)] w-[min(100%-1.5rem,340px)] flex-col gap-2 overflow-y-auto overscroll-contain sm:left-4 sm:top-4">
          <section className="panel-black rounded-2xl">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-1 rounded-lg border border-white/[0.06] bg-black p-0.5">
                  {(["driving", "motorbike"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProfile(p)}
                      className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition ${
                        profile === p ? "bg-white text-black" : "text-neutral-500"
                      }`}
                    >
                      {PROFILE_LABELS[p]}
                    </button>
                  ))}
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] text-neutral-600">
                  <input
                    type="checkbox"
                    checked={alternatives}
                    onChange={(e) => setAlternatives(e.target.checked)}
                    className="rounded border-neutral-700 bg-black text-white focus:ring-white/20"
                  />
                  Phụ
                </label>
              </div>
            </div>

            <div className="relative isolate px-4 py-3">
              <div className="pointer-events-none absolute bottom-8 left-[1.65rem] top-8 w-px bg-gradient-to-b from-white/30 via-neutral-700/40 to-white/20" />
              <div className="space-y-2">
                <SearchField
                  label="Điểm đi"
                  value={fromQuery}
                  onChange={setFromQuery}
                  onPick={pickFrom}
                  onFocus={() => setActiveField("from")}
                  onAdjustPosition={() => startAdjustSession("from")}
                  isAdjusting={pickSession?.field === "from"}
                  canAdjust={Boolean(from)}
                  bias={searchBias}
                  accentClass="bg-white"
                  active={activeField === "from"}
                />
                <SearchField
                  label="Điểm đến"
                  value={toQuery}
                  onChange={setToQuery}
                  onPick={pickTo}
                  onFocus={() => setActiveField("to")}
                  onAdjustPosition={() => startAdjustSession("to")}
                  isAdjusting={pickSession?.field === "to"}
                  canAdjust={Boolean(to)}
                  bias={searchBias}
                  accentClass="bg-neutral-500"
                  active={activeField === "to"}
                />
              </div>
              <button
                type="button"
                onClick={swapPoints}
                className="absolute right-5 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg border border-white/[0.1] bg-black text-neutral-500 transition hover:border-white/25 hover:text-white"
                title="Đổi chiều"
              >
                <SwapIcon />
              </button>
            </div>

            <div className="space-y-3 border-t border-white/[0.06] px-4 py-3">
              <button
                type="button"
                onClick={runRoute}
                disabled={loading || osrm !== "ok" || !from || !to}
                className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Đang tính…" : "Tìm đường"}
              </button>
              {error && (
                <p className="rounded-lg border border-rose-500/20 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}
              {activeRoute && (
                <div className="rounded-xl border border-white/[0.06] bg-black px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold tabular-nums text-white">
                      {fmtDist(activeRoute.distance)}
                    </span>
                    <span className="text-sm tabular-nums text-neutral-400">
                      {activeRoute.duration ? fmtDur(activeRoute.duration) : "—"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-neutral-600">{DURATION_DISCLAIMER}</p>
                  {routes.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {routes.map((r, i) => (
                        <button
                          key={r.index}
                          type="button"
                          onClick={() => setActiveIndex(i)}
                          className={`rounded-md px-2 py-1 text-[10px] font-medium transition ${
                            i === activeIndex
                              ? "bg-white/10 text-white"
                              : "text-neutral-600 hover:text-neutral-400"
                          }`}
                        >
                          {r.recommended ? "Đề xuất" : `${i + 1}`}
                          {r.duration != null && ` · ${fmtDur(r.duration)}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </aside>
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-white/10 bg-black px-4 py-2 text-sm text-white shadow-2xl backdrop-blur-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
