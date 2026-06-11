import { useCallback, useMemo, useState } from "react";
import { MapView } from "../components/MapView";
import { SearchField } from "../components/SearchField";
import { fetchRoute } from "../lib/api";
import {
  DEFAULT_FROM,
  DEFAULT_TO,
  DURATION_DISCLAIMER,
  fmtDist,
  fmtDur,
  PROFILE_LABELS,
} from "../lib/format";
import type { GeocodeResult, Point, RouteData, RouteOption, RoutingProfile } from "../types";

function SwapIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export default function RoutingView({ osrm }: { osrm: "ok" | "down" | "loading" }) {
  const [from, setFrom] = useState<Point>({ ...DEFAULT_FROM });
  const [to, setTo] = useState<Point>({ ...DEFAULT_TO });
  const [fromQuery, setFromQuery] = useState(DEFAULT_FROM.name ?? "");
  const [toQuery, setToQuery] = useState(DEFAULT_TO.name ?? "");
  const [profile, setProfile] = useState<RoutingProfile>("driving");
  const [alternatives, setAlternatives] = useState(true);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"summary" | "json">("summary");
  const [toast, setToast] = useState<string | null>(null);

  const searchBias = useMemo(
    () => ({ lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 }),
    [from, to],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const pickFrom = (r: GeocodeResult) => {
    setFrom({ lat: r.lat, lng: r.lng, name: r.displayName });
  };

  const pickTo = (r: GeocodeResult) => {
    setTo({ lat: r.lat, lng: r.lng, name: r.displayName });
  };

  const swapPoints = () => {
    setFrom(to);
    setTo(from);
    setFromQuery(toQuery);
    setToQuery(fromQuery);
    setRoutes([]);
    setRouteData(null);
    setError(null);
  };

  const runRoute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRoute(from, to, profile, alternatives);
      setRouteData(data);
      setRoutes(data.routes);
      setActiveIndex(0);
      setTab("summary");
      showToast("Tuyến đường sẵn sàng");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Routing failed");
      setRoutes([]);
      setRouteData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, profile, alternatives]);

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
          {!routeData && !loading && (
            <div className="pointer-events-none absolute inset-x-0 top-6 z-[400] flex justify-center px-4">
              <div className="rounded-full border border-white/[0.08] bg-black/90 px-4 py-2 text-xs text-neutral-500 backdrop-blur-md">
                Nhập điểm đi / đến và bấm <span className="text-white">Tìm đường</span>
              </div>
            </div>
          )}
          <MapView from={from} to={to} routes={routes} activeIndex={activeIndex} />
        </div>

        <aside className="absolute left-3 top-3 z-[600] flex max-h-[calc(100vh-7rem)] w-[min(100%-1.5rem,340px)] flex-col gap-2 overflow-y-auto overscroll-contain sm:left-4 sm:top-4">
          <section className="panel-black rounded-2xl">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Playaround</p>
              <div className="mt-2 flex rounded-lg border border-white/[0.06] bg-black p-0.5">
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
            </div>

            <div className="relative isolate px-4 py-3">
              <div className="pointer-events-none absolute bottom-8 left-[1.65rem] top-8 w-px bg-gradient-to-b from-white/30 via-neutral-700/40 to-white/20" />
              <div className="space-y-2">
                <SearchField
                  label="Điểm đi"
                  value={fromQuery}
                  onChange={setFromQuery}
                  onPick={pickFrom}
                  bias={searchBias}
                  accentClass="bg-white"
                />
                <SearchField
                  label="Điểm đến"
                  value={toQuery}
                  onChange={setToQuery}
                  onPick={pickTo}
                  bias={searchBias}
                  accentClass="bg-neutral-500"
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
              <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
                <input
                  type="checkbox"
                  checked={alternatives}
                  onChange={(e) => setAlternatives(e.target.checked)}
                  className="rounded border-neutral-700 bg-black text-white focus:ring-white/20"
                />
                Tuyến thay thế
              </label>
              <button
                type="button"
                onClick={runRoute}
                disabled={loading || osrm !== "ok"}
                className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Đang tính…" : "Tìm đường"}
              </button>
              {error && (
                <p className="rounded-lg border border-rose-500/20 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                  {error}
                </p>
              )}
            </div>
          </section>

          {routes.length > 1 && (
            <section className="panel-black rounded-2xl p-3">
              <h3 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Tuyến khả dụng
              </h3>
              <div className="space-y-1">
                {routes.map((r, i) => (
                  <button
                    key={r.index}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                      i === activeIndex
                        ? "border-white/20 bg-white/[0.06]"
                        : "border-white/[0.06] bg-black hover:border-white/12"
                    }`}
                  >
                    <span className={`text-xs font-medium ${i === activeIndex ? "text-white" : "text-neutral-500"}`}>
                      {r.recommended ? "Đề xuất" : `Tuyến ${i + 1}`}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-neutral-600">
                      {fmtDist(r.distance)}
                      {r.duration != null && ` · ${fmtDur(r.duration)}`}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>

        <aside className="absolute bottom-3 right-3 top-auto z-[600] flex max-h-[min(52vh,420px)] w-[min(100%-1.5rem,360px)] flex-col sm:bottom-auto sm:right-4 sm:top-4 sm:max-h-[calc(100vh-7rem)]">
          <section className="panel-black flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
            {activeRoute ? (
              <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06] bg-black">
                <StatPill label="Quãng đường" value={fmtDist(activeRoute.distance)} />
                <StatPill
                  label="Thời gian"
                  value={activeRoute.duration ? fmtDur(activeRoute.duration) : "—"}
                  accent
                />
                <StatPill label="Phương tiện" value={PROFILE_LABELS[profile]} muted />
              </div>
            ) : (
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Kết quả</p>
                <p className="mt-1 text-xs text-neutral-600">Chưa có tuyến nào</p>
              </div>
            )}

            <div className="flex shrink-0 border-b border-white/[0.06]">
              {(["summary", "json"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                    tab === t ? "border-b-2 border-white text-white" : "text-neutral-600 hover:text-neutral-400"
                  }`}
                >
                  {t === "summary" ? "Tóm tắt" : "JSON"}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 text-sm">
              {tab === "summary" && (
                <div className="space-y-3 text-neutral-300">
                  {!routeData && (
                    <p className="text-xs leading-relaxed text-neutral-500">
                      Chọn phương tiện, nhập địa chỉ hai điểm rồi bấm{" "}
                      <span className="text-white">Tìm đường</span>.
                    </p>
                  )}
                  {routeData && activeRoute && (
                    <>
                      <DetailRow label="Điểm đi" value={from.name ?? fromQuery} />
                      <DetailRow label="Điểm đến" value={to.name ?? toQuery} />
                      <DetailRow label="Khoảng cách" value={fmtDist(activeRoute.distance)} strong />
                      {activeRoute.duration != null && (
                        <div>
                          <DetailRow label="Thời gian" value={fmtDur(activeRoute.duration)} strong />
                          <p className="mt-1 text-[10px] leading-relaxed text-neutral-600">{DURATION_DISCLAIMER}</p>
                        </div>
                      )}
                      {routes.length > 1 && <DetailRow label="Số tuyến" value={String(routes.length)} />}
                    </>
                  )}
                </div>
              )}
              {tab === "json" && (
                <pre className="font-mono text-[10px] leading-relaxed text-neutral-600">
                  {JSON.stringify(routeData ?? {}, null, 2)}
                </pre>
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

function StatPill({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  const valueCls = accent ? "text-white" : muted ? "text-neutral-500" : "text-white";
  return (
    <div className="px-3 py-2.5 text-center">
      <div className={`text-sm font-semibold tabular-nums ${valueCls}`}>{value}</div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-neutral-600">{label}</div>
    </div>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-600">{label}</p>
      <p className={`mt-0.5 text-xs leading-relaxed ${strong ? "font-medium text-white" : "text-neutral-400"}`}>
        {value}
      </p>
    </div>
  );
}
