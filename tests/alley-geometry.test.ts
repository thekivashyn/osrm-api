import { describe, expect, test } from "bun:test";
import {
  ALLEY_HOUSE_SPACING_M,
  destinationPoint,
  estimateAlleyHousePosition,
  interpolateHouseAnchors,
} from "../src/utils/alley-geometry";

describe("alley-geometry", () => {
  test("destinationPoint moves roughly south by requested metres", () => {
    const [lng, lat] = destinationPoint(106.642594, 10.762539, 190, 100);
    expect(lat).toBeLessThan(10.762539);
    expect(Math.abs(lng - 106.642594)).toBeLessThan(0.001);
  });

  test("interpolateHouseAnchors extrapolates beyond upper anchor", () => {
    const [lng, lat] = interpolateHouseAnchors(
      { house: 18, lat: 10.762, lng: 106.642 },
      { house: 40, lat: 10.761, lng: 106.642 },
      25,
    );
    expect(lat).toBeLessThan(10.762);
    expect(lat).toBeGreaterThan(10.761);
    expect(lng).toBeCloseTo(106.642, 3);
  });

  test("estimateAlleyHousePosition uses mouth depth when anchor is at mouth", () => {
    const mouth = { lat: 10.762539, lng: 106.642594 };
    const anchors = [{ house: 18, lat: 10.762495, lng: 106.642548 }];
    const [lng, lat] = estimateAlleyHousePosition(25, mouth, anchors)!;
    const expectedDepth = 25 * ALLEY_HOUSE_SPACING_M;
    const [expLng, expLat] = destinationPoint(mouth.lng, mouth.lat, 190, expectedDepth);
    expect(lat).toBeCloseTo(expLat, 4);
    expect(lng).toBeCloseTo(expLng, 4);
    expect(lat).toBeLessThan(anchors[0]!.lat);
  });

  test("estimateAlleyHousePosition linear between two anchors", () => {
    const [lng, lat] = estimateAlleyHousePosition(
      25,
      null,
      [
        { house: 18, lat: 10.762, lng: 106.642 },
        { house: 40, lat: 10.761, lng: 106.642 },
      ],
    )!;
    expect(lat).toBeLessThan(10.762);
    expect(lat).toBeGreaterThan(10.761);
    expect(lng).toBeCloseTo(106.642, 3);
  });
});
