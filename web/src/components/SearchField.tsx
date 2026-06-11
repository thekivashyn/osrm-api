import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GeocodeResult, Point } from "../types";
import { fetchGeocode } from "../lib/api";

const DEBOUNCE_MS = 650;
const NEAR_KM = 25;
const LIST_MAX_H = 224;

type ListPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function SearchField({
  label,
  value,
  onChange,
  onPick,
  bias,
  accentClass,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (r: GeocodeResult) => void;
  bias: Point;
  accentClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [listPos, setListPos] = useState<ListPos | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const biasRef = useRef(bias);
  biasRef.current = bias;

  const updateListPos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < LIST_MAX_H && spaceAbove > spaceBelow;
    const maxHeight = Math.min(LIST_MAX_H, openUp ? spaceAbove : spaceBelow);
    setListPos({
      top: openUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(maxHeight, 120),
    });
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const items = await fetchGeocode(q, biasRef.current);
      setResults(items);
      const focused = inputRef.current === document.activeElement;
      setOpen(items.length > 0 && focused);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, runSearch]);

  useEffect(() => {
    if (inputRef.current !== document.activeElement) return;
    if (value.trim().length < 2) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
  }, [bias, value, runSearch]);

  useEffect(() => {
    if (!open) return;
    updateListPos();
    window.addEventListener("resize", updateListPos);
    window.addEventListener("scroll", updateListPos, true);
    return () => {
      window.removeEventListener("resize", updateListPos);
      window.removeEventListener("scroll", updateListPos, true);
    };
  }, [open, results, updateListPos]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const dropdown =
    open && results.length > 0 && listPos
      ? createPortal(
          <ul
            ref={listRef}
            role="listbox"
            className="fixed overflow-auto rounded-xl border border-white/[0.08] bg-black py-1 shadow-2xl shadow-black/80 backdrop-blur-xl"
            style={{
              top: listPos.top,
              left: listPos.left,
              width: listPos.width,
              maxHeight: listPos.maxHeight,
              zIndex: 9000,
            }}
          >
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-white/[0.04]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(r);
                    onChange(r.displayName);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs leading-snug text-neutral-200">{r.displayName}</span>
                    {r.distanceKm != null && r.distanceKm <= NEAR_KM && (
                      <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                        Gần bạn
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-neutral-600">
                    {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className="relative">
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      <div ref={anchorRef} className="relative">
        <span
          className={`pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${accentClass}`}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (results.length) {
              updateListPos();
              setOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!listRef.current?.contains(document.activeElement)) setOpen(false);
            }, 0);
          }}
          className="w-full rounded-lg border border-white/[0.08] bg-black py-2.5 pl-8 pr-3 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
          placeholder="Tìm địa chỉ…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
        )}
      </div>
      {dropdown}
    </div>
  );
}
