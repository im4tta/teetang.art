import { describe, expect, it } from "vitest";
import {
  matchesLayoutSize,
  normalizePosterSizeValue,
  resolveLayoutIdForSize,
} from "@/services/layout/layoutMatcher";
import { CUSTOM_LAYOUT_ID, type Layout } from "@/services/layout/types";

const a4: Layout = {
  id: "a4",
  name: "A4",
  description: "A4 poster",
  width: 21,
  height: 29.7,
  unit: "cm",
  widthCm: 21,
  heightCm: 29.7,
  symbol: "A4",
  categoryId: "paper",
  categoryName: "Paper",
};

describe("layout matching", () => {
  it("matches sizes inside the configured tolerance", () => {
    expect(matchesLayoutSize(a4, 21.005, 29.695, 0.01)).toBe(true);
    expect(matchesLayoutSize(a4, 21.02, 29.7, 0.01)).toBe(false);
  });

  it("resolves known and custom sizes", () => {
    expect(resolveLayoutIdForSize(21, 29.7, "a4", 0.01, a4, [a4])).toBe("a4");
    expect(resolveLayoutIdForSize(20, 30, "a4", 0.01, a4, [a4])).toBe(CUSTOM_LAYOUT_ID);
  });

  it("normalizes invalid and out-of-range dimensions", () => {
    expect(normalizePosterSizeValue("nope", 20, 4, 45)).toBe(20);
    expect(normalizePosterSizeValue(100, 20, 4, 45)).toBe(45);
  });
});
