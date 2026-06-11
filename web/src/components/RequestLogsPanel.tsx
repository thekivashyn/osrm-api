import { type ReactNode, useMemo, useState } from "react";
import { useRequestLogs } from "../hooks/useRequestLogs";
import type { RequestLogEntry, RequestLogsQuery } from "../types";

function StatusPill({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  const warn = status >= 400 && status < 500;
  const cls = ok
    ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25"
    : warn
      ? "bg-amber-500/15 text-amber-400 ring-amber-500/25"
      : "bg-rose-500/15 text-rose-400 ring-rose-500/25";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 font-mono text-[11px] ring-1 ${cls}`}>
      {status}
    </span>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function fullPath(entry: RequestLogEntry) {
  return entry.query ? `${entry.path}?${entry.query}` : entry.path;
}

function LogDetail({ entry, onClose }: { entry: RequestLogEntry; onClose: () => void }) {
  const json = JSON.stringify(entry, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      /* ignore */
    }
  };

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Request ID", value: entry.id, mono: true },
    { label: "Thời gian (ICT)", value: formatTime(entry.timestamp) },
    { label: "Method", value: entry.method, mono: true },
    { label: "Path", value: fullPath(entry), mono: true },
    { label: "HTTP status", value: String(entry.status), mono: true },
    { label: "Duration", value: `${entry.durationMs} ms`, mono: true },
    { label: "Client IP", value: entry.clientIp, mono: true },
    { label: "X-Forwarded-For", value: entry.forwardedFor ?? "—", mono: true },
    { label: "Host", value: entry.host ?? "—", mono: true },
    { label: "Protocol", value: entry.protocol ?? "—", mono: true },
    { label: "Referer", value: entry.referer ?? "—", mono: true },
    { label: "User-Agent", value: entry.userAgent, mono: true },
    {
      label: "Request Content-Length",
      value: entry.requestContentLength != null ? String(entry.requestContentLength) : "—",
      mono: true,
    },
    { label: "Response Content-Type", value: entry.responseContentType ?? "—", mono: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        className="panel-black max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
        role="dialog"
        aria-labelledby="log-detail-title"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <p id="log-detail-title" className="text-sm font-semibold text-white">
              Chi tiết request
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-neutral-600">{entry.id}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
            >
              Copy JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
            >
              Đóng
            </button>
          </div>
        </div>
        <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-4">
          <dl className="space-y-3">
            {rows.map((r) => (
              <div key={r.label} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                  {r.label}
                </dt>
                <dd
                  className={`break-all text-xs text-neutral-300 ${r.mono ? "font-mono text-[11px]" : ""}`}
                >
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06] bg-black p-3 font-mono text-[10px] leading-relaxed text-neutral-500">
            {json}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function RequestLogsPanel({ embedded }: { embedded?: boolean }) {
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [path, setPath] = useState("");
  const [ip, setIp] = useState("");
  const [hideHealth, setHideHealth] = useState(true);
  const [selected, setSelected] = useState<RequestLogEntry | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const query = useMemo((): RequestLogsQuery => {
    const q: RequestLogsQuery = { limit, offset };
    if (method) q.method = method;
    if (status) q.status = Number(status);
    if (path) q.path = path;
    if (ip) q.ip = ip;
    return q;
  }, [method, status, path, ip, offset]);

  const { items, total, stored, maxStored, loading, error, refresh } = useRequestLogs(query);

  const visible = useMemo(
    () => (hideHealth ? items.filter((e) => e.path !== "/health") : items),
    [items, hideHealth],
  );

  const exportJson = async () => {
    const text = JSON.stringify(visible, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const pageIndex = Math.floor(offset / limit) + 1;

  return (
    <div className={embedded ? "" : "mt-8"}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Audit logs</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Truy xuất đầy đủ mọi request qua API — IP, proxy headers, timing, status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white disabled:opacity-50"
          >
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white"
          >
            Copy trang hiện tại
          </button>
        </div>
      </div>

      <div className="panel-black mb-4 rounded-2xl p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Method">
            <select
              value={method}
              onChange={(e) => {
                setOffset(0);
                setMethod(e.target.value);
              }}
              className="w-full rounded-lg border border-white/[0.08] bg-black px-3 py-2 text-xs text-neutral-200 outline-none focus:border-emerald-500/40"
            >
              <option value="">Tất cả</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </FilterField>
          <FilterField label="Status">
            <input
              value={status}
              onChange={(e) => {
                setOffset(0);
                setStatus(e.target.value.replace(/\D/g, ""));
              }}
              placeholder="vd. 200, 404"
              className="w-full rounded-lg border border-white/[0.08] bg-black px-3 py-2 font-mono text-xs text-neutral-200 outline-none focus:border-emerald-500/40"
            />
          </FilterField>
          <FilterField label="Path / query">
            <input
              value={path}
              onChange={(e) => {
                setOffset(0);
                setPath(e.target.value);
              }}
              placeholder="/api/route"
              className="w-full rounded-lg border border-white/[0.08] bg-black px-3 py-2 font-mono text-xs text-neutral-200 outline-none focus:border-emerald-500/40"
            />
          </FilterField>
          <FilterField label="IP">
            <input
              value={ip}
              onChange={(e) => {
                setOffset(0);
                setIp(e.target.value);
              }}
              placeholder="203.0.113.1"
              className="w-full rounded-lg border border-white/[0.08] bg-black px-3 py-2 font-mono text-xs text-neutral-200 outline-none focus:border-emerald-500/40"
            />
          </FilterField>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={hideHealth}
            onChange={(e) => setHideHealth(e.target.checked)}
            className="rounded border-white/20 bg-black"
          />
          Ẩn probe <span className="font-mono text-neutral-600">GET /health</span>
        </label>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
        <span>
          Hiển thị <strong className="text-neutral-400">{visible.length}</strong> / {total} khớp bộ lọc
        </span>
        <span>·</span>
        <span>
          Buffer <strong className="text-neutral-400">{stored}</strong> / {maxStored}
        </span>
        <span>·</span>
        <span className="text-emerald-500/80">Live · 5s</span>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="panel-black overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] uppercase tracking-wider text-neutral-600">
                <th className="px-4 py-2.5">Thời gian</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Path</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">ms</th>
                <th className="px-4 py-2.5">Client IP</th>
                <th className="px-4 py-2.5">Request ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-600">
                    {loading ? "Đang tải logs…" : "Chưa có log khớp bộ lọc."}
                  </td>
                </tr>
              ) : (
                visible.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelected(entry)}
                    className="cursor-pointer text-neutral-400 transition hover:bg-white/[0.03]"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[10px] text-neutral-500">
                      {formatTime(entry.timestamp)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-mono font-semibold ${
                          entry.method === "GET" ? "text-emerald-400" : "text-white"
                        }`}
                      >
                        {entry.method}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5 font-mono text-[11px] text-neutral-300">
                      {fullPath(entry)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={entry.status} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-neutral-500">{entry.durationMs}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-neutral-400">{entry.clientIp}</td>
                    <td className="max-w-[8rem] truncate px-4 py-2.5 font-mono text-[10px] text-neutral-600">
                      {entry.id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-neutral-500 disabled:opacity-40 hover:text-white"
            >
              ← Trước
            </button>
            <span className="font-mono text-[11px] text-neutral-600">
              Trang {pageIndex} / {pageCount}
            </span>
            <button
              type="button"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-neutral-500 disabled:opacity-40 hover:text-white"
            >
              Sau →
            </button>
          </div>
        )}
      </div>

      {selected && <LogDetail entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
        {label}
      </span>
      {children}
    </label>
  );
}
