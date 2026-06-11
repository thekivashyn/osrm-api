import { useEffect, useRef, useState } from "react";
import { fetchRoute } from "../lib/api";
import type { Point, RouteOption, RoutingProfile } from "../types";

export function useGhostRoute(
  from: Point | null,
  to: Point | null,
  profile: RoutingProfile,
  enabled: boolean,
  debounceMs = 450,
) {
  const [ghostRoute, setGhostRoute] = useState<RouteOption | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!enabled || !from || !to) {
      setGhostRoute(null);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchRoute(from, to, profile, false);
        if (id !== reqId.current) return;
        setGhostRoute(data.routes[0] ?? null);
      } catch {
        if (id === reqId.current) setGhostRoute(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, debounceMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [from?.lat, from?.lng, to?.lat, to?.lng, profile, enabled, debounceMs]);

  return { ghostRoute, ghostLoading: loading };
}
