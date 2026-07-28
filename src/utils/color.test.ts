import { describe, expect, it } from "vitest";
import {
  blendHex,
  hslToRgb,
  normalizeHexColor,
  parseHex,
  rgbToHsl,
  toUniqueHexColors,
} from "@/utils/color";

describe("color utilities", () => {
  it("normalizes and deduplicates valid hex colors", () => {
    expect(normalizeHexColor(" #AbC ")).toBe("#aabbcc");
    expect(normalizeHexColor("invalid")).toBe("");
    expect(toUniqueHexColors(["#abc", "#AABBCC", "bad", "#fff"])).toEqual(["#aabbcc", "#ffffff"]);
  });

  it("parses colors and round-trips RGB through HSL", () => {
    const rgb = parseHex("#336699");
    expect(rgb).toEqual({ r: 51, g: 102, b: 153 });
    expect(hslToRgb(rgbToHsl(rgb!))).toEqual(rgb);
  });

  it("blends endpoints and midpoints", () => {
    expect(blendHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(blendHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(blendHex("#000000", "#ffffff", 1)).toBe("#ffffff");
  });
});
