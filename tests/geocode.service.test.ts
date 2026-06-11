import { afterEach, describe, expect, test } from "bun:test";
import {
  buildViewbox,
  clearGeocodeCaches,
  reverseGeocode,
  searchAddress,
} from "../src/services/geocode.service";
import { haversineKm } from "../src/utils/geo";

describe("buildViewbox", () => {
  test("builds Nominatim corner string from center and delta", () => {
    expect(buildViewbox(10.78, 106.69, 0.35)).toBe("106.34000,11.13000,107.04000,10.43000");
  });
});

describe("searchAddress — location bias", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearGeocodeCaches();
  });

  test("includes viewbox when lat/lng provided", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Response.json([
        { lat: "10.78", lon: "106.69", display_name: "Test, Ho Chi Minh City, Vietnam" },
      ]);
    }) as typeof fetch;

    await searchAddress("Le Loi", 5, { lat: 10.78, lng: 106.69 });

    const url = new URL(requestedUrl);
    expect(url.searchParams.get("viewbox")).toBe("106.34000,11.13000,107.04000,10.43000");
    expect(url.searchParams.get("accept-language")).toBe("vi");
    expect(url.searchParams.get("countrycodes")).toBe("vn");
  });

  test("omits viewbox when coordinates missing", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return Response.json([
        { lat: "21.03", lon: "105.85", display_name: "Le Loi, Hanoi, Vietnam" },
      ]);
    }) as typeof fetch;

    await searchAddress("Le Loi", 5);

    expect(new URL(requestedUrl).searchParams.has("viewbox")).toBe(false);
  });

  test("returns cached results without second fetch", async () => {
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return Response.json([
        { lat: "10.78", lon: "106.69", display_name: "Cached, Ho Chi Minh City, Vietnam" },
      ]);
    }) as typeof fetch;

    await searchAddress("Cached", 5, { lat: 10.78, lng: 106.69 });
    await searchAddress("Cached", 5, { lat: 10.78, lng: 106.69 });

    expect(fetchCount).toBe(1);
  });

  test("includes distanceKm when bias provided", async () => {
    globalThis.fetch = (async () =>
      Response.json([
        { lat: "10.78", lon: "106.69", display_name: "Near, Ho Chi Minh City, Vietnam" },
      ])) as typeof fetch;

    const results = await searchAddress("Near", 5, { lat: 10.78, lng: 106.69 });
    expect(results[0]?.distanceKm).toBe(0);
  });
});

describe("reverseGeocode", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearGeocodeCaches();
  });

  test("reverse geocodes coordinates", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toContain("/reverse");
      return Response.json({
        lat: "10.78",
        lon: "106.69",
        display_name: "Test Street, Ho Chi Minh City, Vietnam",
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
