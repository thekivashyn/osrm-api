import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "../types";

export type UserLocationStatus = "idle" | "loading" | "ready" | "denied" | "unsupported";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 300_000,
};

export function useUserLocation(autoRequest = true) {
  const [position, setPosition] = useState<Point | null>(null);
  const [status, setStatus] = useState<UserLocationStatus>("idle");
  const requested = useRef(false);

  const request = useCallback((): Promise<Point | null> => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return Promise.resolve(null);
    }
    setStatus("loading");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const pt: Point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(pt);
          setStatus("ready");
          resolve(pt);
        },
        () => {
          setStatus("denied");
          resolve(null);
        },
        GEO_OPTIONS,
      );
    });
  }, []);

  useEffect(() => {
    if (!autoRequest || requested.current) return;
    requested.current = true;
    void request();
  }, [autoRequest, request]);

  return { position, status, request };
}
