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
    const requestedUrls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
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

    const url = new URL(requestedUrls[0]!);
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
                properties: {
                  name: "Lạc Long Quân",
                  label: "Lạc Long Quân, Quận 11, TP.HCM",
                  layer: "street",
                  region: "Thành phố Hồ Chí Minh",
                },
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
      // 2025 admin-reorg rewrites (Bình Thới = phường mới ← Quận 11 cũ)
      "230/25 Lạc Long Quân, Quận 11, Thành phố Hồ Chí Minh",
      "230/25 Lạc Long Quân, Phường 3, Quận 11, Thành phố Hồ Chí Minh",
      "230/25 Lạc Long Quân, Phường Bình Thới, Thành phố Hồ Chí Minh",
      "230/25 Lạc Long Quân",
      "230 Lạc Long Quân", // alley-snap (autocomplete, same-alley neighbours)
      "25 Hẻm 230 Lạc Long Quân",
      "25 Ngõ 230 Lạc Long Quân",
      "Hẻm 230 Lạc Long Quân",
      "Ngõ 230 Lạc Long Quân",
      "230 Lạc Long Quân", // alley mouth (/v1/search, interpolation)
      "Lạc Long Quân",
      // original retried nationwide for cross-city intent
      "230/25 Lạc Long Quân, Bình Thới, HCM",
    ]);
    // Display: tên + phường mới + tỉnh/TP mới, quận bị bỏ.
    expect(results[0]?.displayName).toContain("Lạc Long Quân");
    expect(results[0]?.displayName).toContain("Thành phố Hồ Chí Minh");
    expect(results[0]?.displayName).not.toContain("Quận 11");
  });

  test("ranks exact alley match above fallback street guesses", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const text = url.searchParams.get("text") ?? "";
      if (text === "Hẻm 230 lạc long quan") {
        return Response.json({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [106.643, 10.762] },
              properties: {
                label: "Hẻm 230 Lạc Long Quân, TP.HCM",
                layer: "street",
                match_type: "exact",
              },
            },
          ],
        });
      }
      if (text === "25 Ngõ 230 lạc long quan") {
        // Fuzzy stray on a different street — must be filtered out.
        return Response.json({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [106.61, 10.8] },
              properties: {
                label: "25 Đường Ngô Y Linh, TP.HCM",
                layer: "address",
                match_type: "interpolated",
              },
            },
          ],
        });
      }
      if (text === "230/25 lạc long quan") {
        return Response.json({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [106.652, 10.782] },
              properties: {
                label: "Hẻm 958 Lạc Long Quân, TP.HCM",
                layer: "street",
                match_type: "fallback",
              },
            },
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [106.651, 10.781] },
              properties: {
                label: "Hẻm 888 Lạc Long Quân, TP.HCM",
                layer: "street",
                match_type: "fallback",
              },
            },
          ],
        });
      }
      return Response.json({ type: "FeatureCollection", features: [] });
    }) as typeof fetch;

    const results = await searchAddress("230/25 lạc long quan", 6, {
      lat: 10.78,
      lng: 106.65,
    });

    expect(results[0]?.displayName).toContain("Hẻm 230");
    expect(results.some((r) => r.displayName.includes("Hẻm 958"))).toBe(true);
    expect(results.some((r) => r.displayName.includes("Ngô Y Linh"))).toBe(false);
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
                properties: {
                  name: "Hồ Gươm",
                  label: "Hồ Gươm, Hà Nội",
                  layer: "venue",
                  region: "Thành phố Hà Nội",
                },
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

  test("appends far-city extras after nearby matches", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const nationwide = url.searchParams.get("boundary.circle.radius") == null;
      return Response.json({
        type: "FeatureCollection",
        features: nationwide
          ? [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [105.852, 21.029] },
                properties: {
                  name: "Hồ Hoàn Kiếm",
                  layer: "venue",
                  distance: 1130,
                  region: "Thành phố Hà Nội",
                },
              },
            ]
          : [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [106.695, 10.782] },
                properties: {
                  name: "Hồ Con Rùa",
                  layer: "venue",
                  distance: 1.2,
                  region: "Thành phố Hồ Chí Minh",
                },
              },
            ],
      });
    }) as typeof fetch;

    const results = await searchAddress("Hồ Hoàn Kiếm Hà Nội", 5, { lat: 10.78, lng: 106.69 });

    expect(results[0]?.displayName).toContain("Hồ Con Rùa");
    expect(results[0]?.displayName).toContain("Thành phố Hồ Chí Minh");
    expect(results[1]?.displayName).toContain("Hồ Hoàn Kiếm");
    expect(results[1]?.displayName).toContain("Thành phố Hà Nội");
  });

  test("uses /v1/search for plain house numbers (interpolation)", async () => {
    const paths: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      paths.push(new URL(String(input)).pathname);
      return Response.json({ type: "FeatureCollection", features: [] });
    }) as typeof fetch;

    await searchAddress("230 lac long quan", 5, { lat: 10.78, lng: 106.69 });

    expect(paths[0]).toContain("/v1/search");
  });

  test("compound house numbers skip libpostal → /v1/autocomplete", async () => {
    const verbatimPaths: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.searchParams.get("text") === "230/25 lac long") {
        verbatimPaths.push(url.pathname);
      }
      return Response.json({ type: "FeatureCollection", features: [] });
    }) as typeof fetch;

    await searchAddress("230/25 lac long", 5, { lat: 10.78, lng: 106.69 });

    // libpostal would parse "230/25" into unit+housenumber and never match
    // the indexed compound docs, so these must go through autocomplete.
    expect(verbatimPaths.length).toBeGreaterThan(0);
    expect(verbatimPaths.every((p) => p.includes("/v1/autocomplete"))).toBe(true);
  });

  test("snaps to the closest same-alley neighbour when exact pin missing", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const isSnap =
        url.pathname.includes("autocomplete") &&
        url.searchParams.get("text") === "230 Lạc Long Quân";
      return Response.json({
        type: "FeatureCollection",
        features: isSnap
          ? [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [106.642594, 10.762539] },
                properties: {
                  name: "Hẻm 230 Lạc Long Quân",
                  layer: "street",
                  region: "Thành phố Hồ Chí Minh",
                },
              },
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [106.642548, 10.762495] },
                properties: {
                  name: "230/18 Hẻm 230 Lạc Long Quân",
                  housenumber: "230/18",
                  street: "Hẻm 230 Lạc Long Quân",
                  layer: "address",
                  region: "Thành phố Hồ Chí Minh",
                },
              },
            ]
          : [],
      });
    }) as typeof fetch;

    const results = await searchAddress("230/25 Lạc Long Quân", 5, {
      lat: 10.76,
      lng: 106.64,
    });

    // Mouth at LLQ + anchor 18 → depth estimate ~125 m into alley for house 25.
    expect(results[0]?.displayName).toContain("230/25 Lạc Long Quân");
    expect(results[0]?.lat).toBeLessThan(10.762);
    expect(results[0]?.lat).toBeGreaterThan(10.761);
    expect(results[0]?.layer).toBe("address");
    expect(results[0]?.alleyMouth?.lat).toBeCloseTo(10.762539, 4);
    expect(results[0]?.alleyMouth?.lng).toBeCloseTo(106.642594, 4);
    // Street-layer noise is dropped for house-number queries.
    expect(results.every((r) => r.layer !== "street")).toBe(true);
  });

  test("street-snaps plain house numbers from venue anchors", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const text = url.searchParams.get("text") ?? "";
      const isStreetGather = text === "Nguyễn Xiển" && url.pathname.includes("autocomplete");
      const isHouseQuery = text === "865 Nguyễn Xiển";
      return Response.json({
        type: "FeatureCollection",
        features:
          isStreetGather || isHouseQuery
            ? [
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [106.832, 10.818] },
                  properties: {
                    layer: "venue",
                    name: "800 Nguyễn Xiển",
                    region: "Thành phố Hồ Chí Minh",
                  },
                },
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [106.835, 10.852] },
                  properties: {
                    layer: "venue",
                    name: "1290 Nguyễn Xiển",
                    region: "Thành phố Hồ Chí Minh",
                  },
                },
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [106.833, 10.82] },
                  properties: {
                    layer: "street",
                    name: "Nguyễn Xiển",
                    street: "Nguyễn Xiển",
                    match_type: "fallback",
                    region: "Thành phố Hồ Chí Minh",
                  },
                  bbox: [106.83, 10.815, 106.84, 10.825],
                },
              ]
            : [],
      });
    }) as typeof fetch;

    const results = await searchAddress("865 Nguyễn Xiển", 5, { lat: 10.815, lng: 106.834 });

    expect(results[0]?.layer).toBe("address");
    expect(results[0]?.displayName).toContain("865");
    expect(results[0]?.estimated).toBe(true);
    expect(results[0]?.lat).toBeGreaterThan(10.818);
    expect(results[0]?.lat).toBeLessThan(10.852);
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
    const fetchesAfterFirst = fetchCount;
    await searchAddress("Cached", 5, { lat: 10.78, lng: 106.69 });

    expect(fetchCount).toBe(fetchesAfterFirst);
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
