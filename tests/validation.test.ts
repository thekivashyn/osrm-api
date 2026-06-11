import { describe, expect, test } from "bun:test";
import { validateCoordinate, validateCoordinates, validateLat, validateLng } from "../src/utils/validation";
import { AppError } from "../src/utils/response";

describe("validateLat", () => {
  test("accepts valid latitude", () => {
    expect(validateLat(0)).toBe(true);
    expect(validateLat(-90)).toBe(true);
    expect(validateLat(90)).toBe(true);
    expect(validateLat(10.762622)).toBe(true);
  });

  test("rejects out of range", () => {
    expect(validateLat(-90.1)).toBe(false);
    expect(validateLat(90.1)).toBe(false);
    expect(validateLat(91)).toBe(false);
    expect(validateLat(-91)).toBe(false);
  });

  test("rejects non-numbers", () => {
    expect(validateLat("10")).toBe(false);
    expect(validateLat(null)).toBe(false);
    expect(validateLat(undefined)).toBe(false);
    expect(validateLat(NaN)).toBe(false);
  });
});

describe("validateLng", () => {
  test("accepts valid longitude", () => {
    expect(validateLng(0)).toBe(true);
    expect(validateLng(-180)).toBe(true);
    expect(validateLng(180)).toBe(true);
    expect(validateLng(106.660172)).toBe(true);
  });

  test("rejects out of range", () => {
    expect(validateLng(-180.1)).toBe(false);
    expect(validateLng(180.1)).toBe(false);
    expect(validateLng(200)).toBe(false);
  });
});

describe("validateCoordinate", () => {
  test("returns coordinate when valid", () => {
    expect(validateCoordinate({ lat: 10.77, lng: 106.68 })).toEqual({
      lat: 10.77,
      lng: 106.68,
    });
  });

  test("throws AppError for invalid lat", () => {
    expect(() => validateCoordinate({ lat: 100, lng: 106 })).toThrow(AppError);
    expect(() => validateCoordinate({ lat: 100, lng: 106 })).toThrow(/lat/);
  });

  test("throws AppError for invalid lng", () => {
    expect(() => validateCoordinate({ lat: 10, lng: 200 })).toThrow(AppError);
    expect(() => validateCoordinate({ lat: 10, lng: 200 })).toThrow(/lng/);
  });

  test("throws AppError for missing object", () => {
    expect(() => validateCoordinate(null)).toThrow(/must be an object/);
    expect(() => validateCoordinate("bad")).toThrow(/must be an object/);
  });

  test("throws AppError for missing fields", () => {
    expect(() => validateCoordinate({ lat: 10 })).toThrow(/lng/);
    expect(() => validateCoordinate({ lng: 106 })).toThrow(/lat/);
  });
});

describe("validateCoordinates", () => {
  test("validates array of coordinates", () => {
    const result = validateCoordinates(
      [
        { lat: 10.76, lng: 106.66 },
        { lat: 10.77, lng: 106.70 },
      ],
      "points",
      2,
    );
    expect(result).toHaveLength(2);
  });

  test("throws when not array", () => {
    expect(() => validateCoordinates("bad", "points")).toThrow(/must be an array/);
  });

  test("throws when too few points", () => {
    expect(() => validateCoordinates([], "points", 2)).toThrow(/at least 2/);
    expect(() => validateCoordinates([{ lat: 10, lng: 106 }], "points", 2)).toThrow(/at least 2/);
  });

  test("throws with indexed label on bad point", () => {
    expect(() =>
      validateCoordinates(
        [
          { lat: 10, lng: 106 },
          { lat: 999, lng: 106 },
        ],
        "points",
        2,
      ),
    ).toThrow(/points\[1\]/);
  });
});
