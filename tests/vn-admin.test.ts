import { describe, expect, test } from "bun:test";
import { expandAdminVariants, normalizeAdminText } from "../src/services/vn-admin";

describe("normalizeAdminText", () => {
  test("strips diacritics and collapses whitespace", () => {
    expect(normalizeAdminText("  Phường   Bình  Thới ")).toBe("phuong binh thoi");
    expect(normalizeAdminText("Đường Lạc Long Quân")).toBe("duong lac long quan");
  });
});

describe("expandAdminVariants — current era → legacy", () => {
  test("new ward name without prefix resolves to legacy district", () => {
    const variants = expandAdminVariants("230/25 Lạc Long Quân, Bình Thới, HCM");
    expect(variants).toContain(
      "230/25 Lạc Long Quân, Quận 11, Thành phố Hồ Chí Minh",
    );
    // Canonical current form is also offered for when the index updates.
    expect(variants).toContain(
      "230/25 Lạc Long Quân, Phường Bình Thới, Thành phố Hồ Chí Minh",
    );
    expect(variants.length).toBeLessThanOrEqual(3);
  });

  test("new ward created in 2025 maps back to legacy ward + district", () => {
    const variants = expandAdminVariants("Phường Sài Gòn, TPHCM");
    expect(
      variants.some((v) => v.includes("Quận 1") && v.includes("Thành phố Hồ Chí Minh")),
    ).toBe(true);
  });
});

describe("expandAdminVariants — legacy era → current", () => {
  test("legacy ward + district rewrites to the new ward, district dropped", () => {
    const variants = expandAdminVariants("Phường Bến Nghé, Quận 1, TPHCM");
    expect(variants).toContain("Phường Sài Gòn, Thành phố Hồ Chí Minh");
  });

  test("numbered legacy ward requires its district for disambiguation", () => {
    const withDistrict = expandAdminVariants("Phường 3, Quận 11, TPHCM");
    expect(withDistrict).toContain("Phường Bình Thới, Thành phố Hồ Chí Minh");

    const withoutDistrict = expandAdminVariants("Phường 3, TPHCM");
    expect(withoutDistrict).toEqual([]);
  });

  test("dissolved province name rewrites to its current province", () => {
    const variants = expandAdminVariants("Thủ Dầu Một, Bình Dương");
    expect(variants.some((v) => v.includes("Thành phố Hồ Chí Minh"))).toBe(true);
  });
});

describe("expandAdminVariants — guards", () => {
  test("returns nothing for plain street queries", () => {
    expect(expandAdminVariants("Lạc Long Quân")).toEqual([]);
    expect(expandAdminVariants("230/25 Lạc Long Quân")).toEqual([]);
  });

  test("never echoes the original query", () => {
    const q = "Phường Bến Nghé, Quận 1, TPHCM";
    expect(expandAdminVariants(q)).not.toContain(q);
  });
});
