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
    expect(results[0]?.displayName).toContain("Le Loi");
    expect(results[0]?.layer).toBe("street");
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
