import { describe, expect, test } from "bun:test";
import { buildPickSession, matchesAlleyStreetName, parseAlleyQuery } from "../web/src/lib/pick-mode";
import type { GeocodeResult } from "../web/src/types";

describe("pick-mode alley", () => {
  test("parseAlleyQuery extracts chain, house, street", () => {
    expect(parseAlleyQuery("230/25 Lạc Long Quân, Bình Thới")).toEqual({
      chain: "230",
      house: 25,
      street: "Lạc Long Quân, Bình Thới",
    });
  });

  test("matchesAlleyStreetName rejects partial chain numbers", () => {
    expect(matchesAlleyStreetName("Hẻm 230 Lạc Long Quân", "230", "Lạc Long Quân")).toBe(true);
    expect(matchesAlleyStreetName("Hẻm 23 Lạc Long Quân", "230", "Lạc Long Quân")).toBe(false);
    expect(matchesAlleyStreetName("Hẻm 958 Lạc Long Quân", "230", "Lạc Long Quân")).toBe(false);
  });

  test("uses alley mouth from geocode + anchor inside alley, not a distant hẻm", () => {
    const mouth = { lat: 10.762539, lng: 106.642594 };
    const anchorEst = { lat: 10.76185, lng: 106.64255 };
    const farHem = { lat: 10.758, lng: 106.642, displayName: "Hẻm 194 Lạc Long Quân" };

    const picked: GeocodeResult = {
      displayName: "230/25 Lạc Long Quân",
      lat: anchorEst.lat,
      lng: anchorEst.lng,
      alleyMouth: mouth,
    };
    const candidates: GeocodeResult[] = [
      picked,
      { displayName: "230/18 Hẻm 230 Lạc Long Quân", lat: 10.762495, lng: 106.642548 },
      farHem,
    ];

    const session = buildPickSession("to", "230/25 Lạc Long Quân", picked, candidates);
    expect(session.alley).toBeDefined();
    expect(session.alley!.mouth.lat).toBeCloseTo(mouth.lat, 5);
    expect(session.alley!.mouth.lng).toBeCloseTo(mouth.lng, 5);
    expect(session.anchor.name).toBe("230/25 Lạc Long Quân");
    expect(session.alley!.depthM).toBeGreaterThan(20);
    expect(session.alley!.depthM).toBeLessThan(150);
  });
});
