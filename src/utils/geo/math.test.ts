import { describe, expect, it } from "vitest";
import { clamp, haversineMeters, toRadians } from "@/utils/geo/math";

describe("geo math", () => {
  it("clamps values to the requested range", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("converts degrees to radians", () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI);
  });

  it("calculates realistic great-circle distances", () => {
    const phnomPenh = { lat: 11.5564, lon: 104.9282 };
    const paris = { lat: 48.8566, lon: 2.3522 };
    expect(haversineMeters(phnomPenh, phnomPenh)).toBe(0);
    const distanceKm = haversineMeters(phnomPenh, paris) / 1000;
    expect(distanceKm).toBeGreaterThan(9900);
    expect(distanceKm).toBeLessThan(10_000);
  });
});
