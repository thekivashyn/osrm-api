import { useEffect, useState } from "react";

export interface ClientIpInfo {
  ip: string;
  userAgent: string;
  timestamp: string;
  forwardedFor: string | null;
}

export function useClientIp() {
  const [info, setInfo] = useState<ClientIpInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/client-ip");
        const json = (await res.json()) as { success: boolean; data?: ClientIpInfo };
        if (!cancelled && json.success && json.data) {
          setInfo(json.data);
        }
      } catch {
        if (!cancelled) {
          setInfo({
            ip: "unknown",
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            forwardedFor: null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { info, loading };
}
