import type { ActiveField } from "../../lib/pick-mode";

/** Minimal pick hint — one line, no buttons (click map = done). */
export function PickGuideOverlay({ field }: { field: ActiveField }) {
  const label = field === "from" ? "điểm đi" : "điểm đến";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-[450] flex justify-center px-4 sm:top-5">
      <p className="rounded-full border border-white/10 bg-black/85 px-4 py-2 text-xs text-neutral-400 shadow-lg backdrop-blur-md">
        Chạm map để chọn <span className="font-medium text-white">{label}</span>
        <span className="mx-2 text-neutral-700">·</span>
        <span className="text-neutral-600">Esc hủy</span>
      </p>
    </div>
  );
}
