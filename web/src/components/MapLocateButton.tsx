function LocateIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
    </svg>
  );
}

export function MapLocateButton({
  onClick,
  loading,
  active,
}: {
  onClick: () => void;
  loading?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title="Vị trí hiện tại (GPS)"
      aria-label="Vị trí hiện tại"
      className={`flex h-9 w-9 items-center justify-center rounded-xl border bg-black/90 shadow-lg backdrop-blur-md transition ${
        active
          ? "border-sky-500/40 text-sky-400"
          : "border-white/[0.1] text-neutral-400 hover:border-white/25 hover:text-white"
      } disabled:opacity-40`}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/10 border-t-sky-400" />
      ) : (
        <LocateIcon />
      )}
    </button>
  );
}
