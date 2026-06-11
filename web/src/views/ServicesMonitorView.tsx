import { useState } from "react";
import { RequestLogsPanel } from "../components/RequestLogsPanel";
import { useSystemMonitor } from "../hooks/useSystemMonitor";

function StatusDot({ ok, pending }: { ok: boolean; pending?: boolean }) {
  const cls = pending
    ? "bg-amber-400 pulse-dot"
    : ok
      ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
      : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.45)]";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

function ServiceCard({
  name,
  status,
  message,
  pending,
}: {
  name: string;
  status: string;
  message?: string;
  pending?: boolean;
}) {
  const ok = status === "ok";
  const label =
    status === "ok"
      ? "Online"
      : status === "down"
        ? "Offline"
        : status === "unreachable"
          ? "Unreachable"
          : "Error";

  return (
    <div className="panel-black rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{name}</p>
          <p className={`mt-1 text-xs ${ok ? "text-neutral-400" : "text-rose-300"}`}>{label}</p>
        </div>
        <StatusDot ok={ok} pending={pending} />
      </div>
      {message && !ok && (
        <p className="mt-2 rounded-lg border border-rose-500/20 bg-rose-950/30 px-2.5 py-2 text-[11px] leading-relaxed text-rose-200/80">
          {message}
        </p>
      )}
    </div>
  );
}

export default function ServicesMonitorView() {
  const { data, loading, error, refresh, allOk } = useSystemMonitor();
  const [tab, setTab] = useState<"services" | "logs">("services");

  return (
    <div className="h-full w-full overflow-y-auto bg-black p-4 sm:p-6">
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Giám sát dịch vụ</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Trạng thái API, OSRM, Nominatim và audit logs truy xuất đầy đủ.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/[0.08] p-0.5">
              {(
                [
                  ["services", "Dịch vụ"],
                  ["logs", "Audit logs"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    tab === id
                      ? "bg-white/[0.08] text-white"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "services" && (
              <button
                type="button"
                onClick={() => refresh()}
                disabled={loading}
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                {loading ? "Đang kiểm tra…" : "Làm mới"}
              </button>
            )}
          </div>
        </div>

        {tab === "logs" ? (
          <RequestLogsPanel embedded />
        ) : (
          <>
            {error && (
              <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
                {error}
              </p>
            )}

            <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black px-4 py-3">
              <StatusDot ok={!!allOk} pending={loading && !data} />
              <span className="text-sm text-neutral-300">
                {loading && !data ? "Đang thu thập…" : allOk ? "Tất cả dịch vụ hoạt động" : "Có dịch vụ lỗi"}
              </span>
              {data?.checkedAt && (
                <span className="ml-auto font-mono text-[10px] text-neutral-600">
                  {new Date(data.checkedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ServiceCard
                name="Routing API"
                status={data?.api.status ?? "ok"}
                pending={loading && !data}
              />
          <ServiceCard
            name="OSRM — Ô tô"
            status={data?.osrmCar.status ?? "down"}
            message={data?.osrmCar.message}
            pending={loading && !data}
          />
          <ServiceCard
            name="OSRM — Xe máy"
            status={data?.osrmMotor.status ?? "down"}
            message={data?.osrmMotor.message}
            pending={loading && !data}
          />
          <ServiceCard
            name="Nominatim Geo"
            status={data?.nominatim.status ?? "down"}
            message={data?.nominatim.message}
            pending={loading && !data}
          />
            </div>

            {data && (
              <div className="panel-black mt-4 rounded-2xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Thông tin API</p>
                <dl className="mt-3 space-y-2 text-xs">
                  <Row label="Service" value={data.api.service} />
                  <Row label="Version" value={data.api.version} mono />
                  <Row label="Health" value="GET /health" mono />
                  <Row label="Poll interval" value="30 giây" />
                  <Row label="Audit logs" value="GET /api/request-logs" mono />
                </dl>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
      <dt className="text-neutral-600">{label}</dt>
      <dd className={`text-right text-neutral-300 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
