import { describe, expect, test } from "bun:test";
import {
  collectStreetAnchors,
  estimateStreetHousePosition,
  parseHouseFromVenueLabel,
  parsePlainHouseStreet,
  snapToStreetHouse,
  streetNormFromQuery,
} from "../src/utils/street-interpolation";

describe("parsePlainHouseStreet", () => {
  test("parses plain house on main street", () => {
    expect(parsePlainHouseStreet("865 Nguyễn Xiển")).toEqual({
      house: "865",
      street: "Nguyễn Xiển",
    });
  });

  test("rejects alley compound numbers", () => {
    expect(parsePlainHouseStreet("230/25 Lạc Long Quân")).toBeNull();
  });

  test("rejects alley-prefixed queries", () => {
    expect(parsePlainHouseStreet("25 Hẻm 230 Lạc Long Quân")).toBeNull();
  });
});

describe("parseHouseFromVenueLabel", () => {
  test("extracts house number before street name", () => {
    const street = streetNormFromQuery("Nguyễn Xiển");
    expect(parseHouseFromVenueLabel("CH Lẻ : 1290 Nguyễn Xiển . Long Bình", street)).toBe(1290);
    expect(parseHouseFromVenueLabel("Số 1 Nguyễn Xiển . Long Trường", street)).toBe(1);
  });

  test("returns null when street not in label", () => {
    expect(parseHouseFromVenueLabel("Bitexco Financial Tower", streetNormFromQuery("Nguyễn Xiển"))).toBeNull();
  });
});

describe("snapToStreetHouse", () => {
  const streetFeature = {
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [106.833, 10.82] as [number, number] },
    properties: {
      layer: "street",
      name: "Nguyễn Xiển",
      street: "Nguyễn Xiển",
      match_type: "fallback",
      region: "Thành phố Hồ Chí Minh",
    },
    bbox: [106.83, 10.815, 106.84, 10.825] as [number, number, number, number],
  };

  const venue1290 = {
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [106.835, 10.852] as [number, number] },
    properties: {
      layer: "venue",
      name: "CH Lẻ : 1290 Nguyễn Xiển . Long Bình",
      region: "Thành phố Hồ Chí Minh",
    },
  };

  const venue800 = {
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [106.832, 10.818] as [number, number] },
    properties: {
      layer: "venue",
      name: "800 Nguyễn Xiển",
      region: "Thành phố Hồ Chí Minh",
    },
  };

  test("interpolates between venue anchors on same street", () => {
    const snapped = snapToStreetHouse([streetFeature, venue800, venue1290], {
      house: "865",
      street: "Nguyễn Xiển",
    });
    expect(snapped).not.toBeNull();
    expect(snapped!.estimated).toBe(true);
    expect(snapped!.feature.properties?.housenumber).toBe("865");
    expect(snapped!.feature.properties?.match_type).toBe("interpolated");
    const [lng, lat] = snapped!.feature.geometry.coordinates;
    expect(lat).toBeGreaterThan(10.818);
    expect(lat).toBeLessThan(10.852);
  });

  test("returns exact anchor when house matches venue pin", () => {
    const snapped = snapToStreetHouse([streetFeature, venue800], {
      house: "800",
      street: "Nguyễn Xiển",
    });
    expect(snapped?.estimated).toBe(false);
    expect(snapped?.feature.geometry.coordinates[1]).toBeCloseTo(10.818, 3);
  });
});

describe("collectStreetAnchors", () => {
  test("collects unique house numbers from venues", () => {
    const street = streetNormFromQuery("Nguyễn Xiển");
    const anchors = collectStreetAnchors(
      [
        {
          geometry: { coordinates: [106.83, 10.81] },
          properties: { layer: "venue", name: "1290 Nguyễn Xiển" },
        },
        {
          geometry: { coordinates: [106.831, 10.812] },
          properties: { layer: "venue", name: "800 Nguyễn Xiển" },
        },
      ],
      street,
    );
    expect(anchors.map((a) => a.house)).toEqual([800, 1290]);
  });
});

describe("estimateStreetHousePosition", () => {
  test("interpolates between two anchors", () => {
    const pos = estimateStreetHousePosition(
      850,
      null,
      [
        { house: 800, lat: 10.81, lng: 106.83 },
        { house: 900, lat: 10.82, lng: 106.831 },
      ],
    );
    expect(pos).not.toBeNull();
    expect(pos![1]).toBeCloseTo(10.815, 2);
  });
});
