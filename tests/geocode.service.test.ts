import { afterEach, describe, expect, test } from "bun:test";
import {
  clearGeocodeCaches,
  reverseGeocode,
  searchAddress,
} from "../src/services/geocode.service";
import { haversineKm } from "../src/utils/geo";

describe("searchAddress — Pelias", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearGeocodeCaches();
  });

  test("calls Pelias autocomplete with focus and country boundary", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [106.69, 10.78] },
            properties: { label: "Le Loi, Ho Chi Minh City, Vietnam", layer: "street" },
          },
        ],
      });
    }) as typeof fetch;

    const results = await searchAddress("Le Loi", 5, { lat: 10.78, lng: 106.69 });

    const url = new URL(requestedUrl);
    expect(url.pathname).toContain("/v1/autocomplete");
    expect(url.searchParams.get("text")).toBe("Le Loi");
    expect(url.searchParams.get("boundary.country")).toBe("VNM");
    expect(url.searchParams.get("focus.point.lat")).toBe("10.78");
    expect(url.searchParams.get("boundary.circle.radius")).toBe("75");
    expect(results[0]?.displayName).toContain("Le Loi");
    expect(results[0]?.layer).toBe("street");
  });

  test("keeps Pelias distance in km (no unit conversion)", async () => {
    globalThis.fetch = (async () =>
      Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [105.8, 21.05] },
            properties: { label: "Ngõ 89 Lạc Long Quân, Hà Nội", distance: 1175.3 },
          },
        ],
      })) as typeof fetch;

    const results = await searchAddress("Ngõ 89", 5, { lat: 10.78, lng: 106.69 });
    expect(results[0]?.distanceKm).toBeCloseTo(1175.3);
  });

  test("falls back to simplified variants near the bias point", async () => {
    const requestedTexts: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requestedTexts.push(url.searchParams.get("text") ?? "");
      const isStreetOnly = url.searchParams.get("text") === "Lạc Long Quân";
      return Response.json({
        type: "FeatureCollection",
        features: isStreetOnly
          ? [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [106.643, 10.763] },
                properties: { label: "Lạc Long Quân, Quận 11, TP.HCM", layer: "street" },
              },
            ]
          : [],
      });
    }) as typeof fetch;

    const results = await searchAddress("230/25 Lạc Long Quân, Bình Thới, HCM", 5, {
      lat: 10.76,
      lng: 106.64,
    });

    expect(requestedTexts).toEqual([
      "230/25 Lạc Long Quân, Bình Thới, HCM",
      "230/25 Lạc Long Quân",
      "230 Lạc Long Quân",
      "Lạc Long Quân",
    ]);
    expect(results[0]?.displayName).toContain("Quận 11");
  });

  test("retries nationwide when nothing matches near the bias", async () => {
    const circleFlags: Array<string | null> = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      circleFlags.push(url.searchParams.get("boundary.circle.radius"));
      const nationwide = url.searchParams.get("boundary.circle.radius") == null;
      return Response.json({
        type: "FeatureCollection",
        features: nationwide
          ? [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [105.852, 21.029] },
                properties: { label: "Hồ Gươm, Hà Nội", layer: "venue" },
              },
            ]
          : [],
      });
    }) as typeof fetch;

    const results = await searchAddress("Hồ Gươm Hà Nội", 5, { lat: 10.78, lng: 106.69 });

    expect(circleFlags.filter((f) => f === "75").length).toBeGreaterThan(0);
    expect(circleFlags[circleFlags.length - 1]).toBeNull();
    expect(results[0]?.displayName).toContain("Hà Nội");
  });

  test("uses /v1/search for queries with digits", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Response.json({ type: "FeatureCollection", features: [] });
    }) as typeof fetch;

    await searchAddress("230/25 lac long", 5, { lat: 10.78, lng: 106.69 });

    expect(new URL(requestedUrl).pathname).toContain("/v1/search");
  });

  test("returns empty array when no features", async () => {
    globalThis.fetch = (async () =>
      Response.json({ type: "FeatureCollection", features: [] })) as typeof fetch;

    const results = await searchAddress("nowhere xyz", 5);
    expect(results).toEqual([]);
  });

  test("returns cached results without second fetch", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [106.69, 10.78] },
            properties: { label: "Cached, Ho Chi Minh City, Vietnam" },
          },
        ],
      });
    }) as typeof fetch;

    await searchAddress("Cached", 5, { lat: 10.78, lng: 106.69 });
    await searchAddress("Cached", 5, { lat: 10.78, lng: 106.69 });

    expect(fetchCount).toBe(1);
  });
});

describe("reverseGeocode — Pelias", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearGeocodeCaches();
  });

  test("reverse geocodes coordinates via /v1/reverse", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toContain("/v1/reverse");
      return Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [106.69, 10.78] },
            properties: { label: "Test Street, Ho Chi Minh City, Vietnam" },
          },
        ],
      });
    }) as typeof fetch;

    const result = await reverseGeocode(10.78, 106.69);
    expect(result.displayName).toContain("Test Street");
    expect(result.lat).toBe(10.78);
  });
});

describe("haversineKm", () => {
  test("returns zero for identical points", () => {
    expect(haversineKm(10.78, 106.69, 10.78, 106.69)).toBe(0);
  });
});
