import { type ReactNode, useEffect } from "react";
import { useClientIp } from "../hooks/useClientIp";

function ShieldIcon() {
  return (
    <svg
      className="h-8 w-8 text-amber-400/90"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 20 7v5c0 4.5-3.2 8.7-8 10-4.8-1.3-8-5.5-8-10V7l8-4z"
      />
      <path strokeLinecap="round" d="M12 11v3M12 8h.01" strokeWidth="2" />
    </svg>
  );
}

export default function HomePage() {
  const { info, loading } = useClientIp();

  useEffect(() => {
    document.body.classList.remove("playground-active");
  }, []);

  const seenAt = info?.timestamp
    ? new Date(info.timestamp).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    : "—";

  const ua = info?.userAgent ?? navigator.userAgent;
  const uaShort = ua.length > 64 ? `${ua.slice(0, 64)}…` : ua;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="gate-enter w-full max-w-md">
        {/* Card */}
        <div className="glass-panel overflow-hidden rounded-2xl">
          {/* Top accent */}
          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

          <div className="p-6 sm:p-8">
            {/* Brand mark */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5">
                <ShieldIcon />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400/90">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 pulse-dot" />
                Live audit
              </span>
            </div>

            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
              Internal access gate
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Hệ thống định tuyến nội bộ. Phiên truy cập của bạn đang được ghi nhận.
            </p>

            {/* Session block */}
            <div className="mt-6 space-y-3 rounded-xl border border-white/[0.04] bg-black/25 p-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  Your IP address
                </p>
                {loading ? (
                  <div className="mt-2 h-8 w-36 animate-pulse rounded bg-slate-800" />
                ) : (
                  <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-amber-400">
                    {info?.ip ?? "—"}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-white/[0.04] pt-3">
                <Meta label="Time (ICT)" loading={loading}>
                  <span className="font-mono text-xs text-slate-300">{seenAt}</span>
                </Meta>
                <Meta label="Status" loading={loading}>
                  <span className="text-xs font-medium text-emerald-400/90">Logged</span>
                </Meta>
              </div>

              <div className="border-t border-white/[0.04] pt-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  User-Agent
                </p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-slate-500" title={ua}>
                  {loading ? "—" : uaShort}
                </p>
              </div>
            </div>

            {!loading && info?.ip && info.ip !== "unknown" && (
              <p className="mt-4 rounded-lg border border-amber-500/10 bg-amber-950/30 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-200/60">
                IP <span className="font-mono text-amber-300/90">{info.ip}</span> có thể đối chiếu
                ISP và làm căn cứ theo <span className="text-amber-300/80">Điều 289 BLHS</span> nếu
                truy cập trái phép.
              </p>
            )}

            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-600">
              Truy cập trái phép bị từ chối.
              <br />
              <span className="text-slate-500">Đóng tab nếu bạn không có quyền truy cập nội bộ.</span>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] tracking-wide text-slate-700">
          ROUTING PLATFORM · CONFIDENTIAL · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

function Meta({
  label,
  children,
  loading,
}: {
  label: string;
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-600">{label}</p>
      <div className="mt-1">
        {loading ? <span className="inline-block h-3 w-16 animate-pulse rounded bg-slate-800" /> : children}
      </div>
    </div>
  );
}
