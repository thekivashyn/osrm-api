import { useClientIp } from "../hooks/useClientIp";

export default function SessionView() {
  const { info, loading } = useClientIp();

  const seenAt = info?.timestamp
    ? new Date(info.timestamp).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "—";

  return (
    <div className="h-full w-full overflow-y-auto bg-black p-4 sm:p-6">
      <div className="w-full">
        <h1 className="text-lg font-semibold text-white">Phiên truy cập</h1>
        <p className="mt-1 text-sm text-neutral-500">Thông tin client được API ghi nhận qua proxy.</p>

        <div className="panel-black mt-6 rounded-2xl p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Your IP</p>
          {loading ? (
            <div className="mt-3 h-9 w-40 animate-pulse rounded bg-neutral-900" />
          ) : (
            <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-white">{info?.ip ?? "—"}</p>
          )}

          <dl className="mt-6 grid gap-4 border-t border-white/[0.06] pt-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Thời gian (ICT)" value={seenAt} loading={loading} />
            <Field label="X-Forwarded-For" value={info?.forwardedFor ?? "—"} loading={loading} mono />
            <Field label="User-Agent" value={info?.userAgent ?? "—"} loading={loading} mono wrap />
          </dl>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-700">
          Dữ liệu từ <span className="font-mono text-neutral-600">GET /api/client-ip</span>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  loading,
  mono,
  wrap,
}: {
  label: string;
  value: string;
  loading?: boolean;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-neutral-600">{label}</dt>
      <dd className={`mt-1 text-neutral-300 ${mono ? "font-mono" : ""} ${wrap ? "break-all leading-relaxed" : ""}`}>
        {loading ? "—" : value}
      </dd>
    </div>
  );
}
