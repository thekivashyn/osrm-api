import type { PickMode } from "../../lib/pick-mode";
import { pickModeLabel } from "../../lib/pick-mode";

export function PickModeBanner({ mode }: { mode: PickMode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-[450] flex justify-center px-4">
      <div className="pick-mode-banner rounded-full border border-emerald-500/30 bg-black/90 px-4 py-2 text-xs text-emerald-100 shadow-lg backdrop-blur-md">
        <span className="font-medium text-white">{pickModeLabel(mode)}</span>
        <span className="mx-2 text-neutral-600">·</span>
        <span className="text-neutral-400">Chạm bản đồ để chọn vị trí</span>
      </div>
    </div>
  );
}
