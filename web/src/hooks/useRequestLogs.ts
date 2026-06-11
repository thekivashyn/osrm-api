import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRequestLogs } from "../lib/api";
import type { RequestLogEntry, RequestLogsQuery } from "../types";

export function useRequestLogs(query: RequestLogsQuery, pollMs = 5_000) {
  const [page, setPage] = useState<{
    total: number;
    stored: number;
    maxStored: number;
    items: RequestLogEntry[];
  }>({
    total: 0,
    stored: 0,
    maxStored: 0,
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryKey = JSON.stringify(query);
  const queryRef = useRef(query);
  queryRef.current = query;

  const refresh = useCallback(async () => {
    try {
      const data = await fetchRequestLogs(queryRef.current);
      setPage({
        total: data.total,
        stored: data.stored,
        maxStored: data.maxStored,
        items: data.items,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logs failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs, queryKey]);

  return { ...page, loading, error, refresh };
}
