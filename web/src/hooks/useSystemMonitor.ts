import { useCallback, useEffect, useState } from "react";
import { fetchMonitorSnapshot } from "../lib/api";
import type { SystemStatusData } from "../types";

export function useSystemMonitor(pollMs = 30_000) {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMonitorSnapshot();
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Monitor failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  const allOk =
    data != null &&
    data.osrmCar.status === "ok" &&
    data.osrmMotor.status === "ok" &&
    data.nominatim.status === "ok";

  return { data, loading, error, refresh, allOk };
}
