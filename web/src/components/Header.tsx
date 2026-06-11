import type { ReactNode } from "react";

function Dot({ state }: { state: "ok" | "down" | "loading" }) {
  const cls =
    state === "ok"
      ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
      : state === "loading"
        ? "bg-amber-400 pulse-dot"
        : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
}

function StatusChip({ label, state }: { label: string; state: "ok" | "down" | "loading" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-black px-2 py-1 text-[10px] font-medium text-neutral-500">
      <Dot state={state} />
      {label}
    </span>
  );
}

export function Header({
  osrm,
  geo,
  title,
  children,
}: {
  osrm: "ok" | "down" | "loading";
  geo: "ok" | "down" | "loading";
  title?: string;
  children?: ReactNode;
}) {
  return (
    <header className="relative z-20 flex h-11 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-black px-4 sm:px-5">
      <p className="truncate text-sm font-medium tracking-tight text-white">{title ?? "Routing Vietnam"}</p>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        <StatusChip
          label={osrm === "ok" ? "OSRM" : osrm === "loading" ? "OSRM…" : "OSRM ✕"}
          state={osrm}
        />
        <StatusChip label={geo === "ok" ? "Geo" : geo === "loading" ? "Geo…" : "Geo ✕"} state={geo} />
        {children}
      </div>
    </header>
  );
}
