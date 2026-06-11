import { useEffect, useState } from "react";
import { fetchGeocodeStatus, fetchOsrmStatus } from "../lib/api";

export function useServiceStatus() {
  const [osrm, setOsrm] = useState<"ok" | "down" | "loading">("loading");
  const [geo, setGeo] = useState<"ok" | "down" | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [o, g] = await Promise.all([fetchOsrmStatus(), fetchGeocodeStatus()]);
        if (cancelled) return;
        setOsrm(o.osrm === "ok" ? "ok" : "down");
        setGeo(g.pelias === "ok" ? "ok" : "down");
      } catch {
        if (!cancelled) {
          setOsrm("down");
          setGeo("down");
        }
      }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { osrm, geo };
}
