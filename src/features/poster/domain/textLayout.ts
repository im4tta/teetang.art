/**
 * Shared poster text layout constants and pure helpers used by both the live
 * preview overlay and the export canvas renderer.
 */
import { parseHex } from "@/shared/utils/color";
export const TEXT_DIMENSION_REFERENCE_PX = 3600;

export const TEXT_CITY_Y_RATIO = 0.845;
export const TEXT_DIVIDER_Y_RATIO = 0.875;
export const TEXT_COUNTRY_Y_RATIO = 0.9;
export const TEXT_COORDS_Y_RATIO = 0.93;

/** Margin from the edges for attribution/credits. */
export const TEXT_EDGE_MARGIN_RATIO = 0.005;

/** City text scales down when labels get long. */
export const CITY_TEXT_SHRINK_THRESHOLD = 10;

export const CITY_FONT_BASE_PX = 250;
export const CITY_FONT_MIN_PX = 110;
export const COUNTRY_FONT_BASE_PX = 92;
export const COORDS_FONT_BASE_PX = 58;
export const ATTRIBUTION_FONT_BASE_PX = 50;

export function isLatinScript(text: string | undefined | null): boolean {
  if (!text) {
    return true;
  }

  let latinCount = 0;
  let alphaCount = 0;

  for (const char of text) {
    if (/[A-Za-z\u00C0-\u024F]/.test(char)) {
      latinCount += 1;
      alphaCount += 1;
    } else if (/\p{L}/u.test(char)) {
      alphaCount += 1;
    }
  }

  if (alphaCount === 0) {
    return true;
  }

  return latinCount / alphaCount > 0.8;
}

export function formatCityLabel(city: string): string {
  return isLatinScript(city) ? city.toUpperCase().split("").join("  ") : city;
}

/**
 * Khmer script range: U+1780-17FF (Khmer), U+19E0-19FF (Khmer Symbols),
 * plus ZWJ/ZWNJ/U+25CC which participate in coeng/roboreang clusters.
 */
const KHMER_CHAR_RE = /[\u1780-\u17FF\u19E0-\u19FF]/;

/** True if the string contains any Khmer (or Khmer Symbols) codepoint. */
export function containsKhmer(text: string | undefined | null): boolean {
  if (!text) {
    return false;
  }
  return KHMER_CHAR_RE.test(text);
}

/**
 * Optical lift (em) applied to Khmer text so its visual midline matches
 * Latin cap-height text under the same font-size. Khmer glyphs use
 * subscript coeng/roboreang clusters that sit in the lower half of the
 * em-box, so without this lift Khmer text appears below English text
 * that shares the same `text-align: center` line. Em-based so it scales
 * with font-size automatically.
 */
export const KHMER_OPTICAL_LIFT_EM = 0.12;

/**
 * Horizontal "nudge" (em) to counteract asymmetric glyph bearings in
 * Khmer fonts — e.g. on iOS, where the system Khmer font ("Khmer Sangam
 * MN") has noticeably larger left-side bearings than the rest of our
 * font stack, which makes centered text look right-shifted. Negative =
 * move text left.
 *
 * IMPORTANT: until now this constant had no real effect anywhere it
 * mattered:
 *  - In the canvas exporter (typography.ts) it only applied inside an
 *    `else` branch that runs when `ctx.measureText()` doesn't return
 *    `actualBoundingBoxLeft`/`actualBoundingBoxRight` — but every current
 *    browser returns those, so that branch never ran. That's why editing
 *    this value never changed the exported poster.
 *  - The "Khmer Sangam MN" scenario it was tuned for never actually
 *    occurred either: the CSS Khmer stack tried to self-host "Battambang"
 *    as an iOS-safe fallback, but that font file was never added to the
 *    project (404 on every load), so the stack always fell through to
 *    our self-hosted Noto Sans Khmer on every platform anyway.
 * Measuring Noto Sans Khmer directly (ink bounding box vs. advance width,
 * with real Khmer place names, including coeng/subscript clusters, at
 * regular and bold weight) shows under 0.5px of asymmetry on text
 * 300-650px wide — i.e. no real bearing skew to correct for. Defaulting
 * to 0 accordingly. The canvas-side dead-code bug above is now fixed, so
 * if you add a different Khmer font later (or still spot a shift on a
 * specific device) this value will actually move the text — tune it by
 * eye and it'll show up in both the live preview and the export.
 */
export const KHMER_OPTICAL_SHIFT_X_EM = 0;

/**
 * Returns a multiplier (≤1) to shrink the city font for long names.
 * Callers apply it to their own base font size.
 */
export function computeCityFontScale(city: string): number {
  const len = Math.max(city.length, 1);
  if (len <= CITY_TEXT_SHRINK_THRESHOLD) {
    return 1;
  }
  return Math.max(CITY_FONT_MIN_PX / CITY_FONT_BASE_PX, CITY_TEXT_SHRINK_THRESHOLD / len);
}

/**
 * Additional scale factor for dual-city mode where each city name
 * must fit within roughly half the poster width.
 */
export function computeDualCityFontScale(city: string): number {
  const baseScale = computeCityFontScale(city);
  const label = formatCityLabel(city);
  // Spaced-out Latin labels are much wider; apply an extra squeeze
  // so each half stays comfortably within ~45 % of the canvas width.
  const extraShrink = label.includes("  ") ? 0.52 : 0.62;
  return Math.max(0.28, baseScale * extraShrink);
}

import type { PosterShape } from "./clipShapes";

/**
 * Y offset for poster text on non-rectangle shapes so text stays inside
 * the clipped region.  Negative values shift text upward.
 */
export function getShapeTextYOffset(shape: PosterShape): number {
  switch (shape) {
    case "star":
      return -0.04;
    case "heart":
      return -0.02;
    case "circle":
    case "diamond":
    case "hexagon":
      return -0.02;
    default:
      return 0;
  }
}

/**
 * Attribution X position for non-rectangle shapes.
 * Returns a safe x-ratio so corner attribution text isn't clipped.
 */
export function getShapeAttributionX(shape: PosterShape, isRight: boolean): number {
  switch (shape) {
    case "circle":
    case "diamond":
      return isRight ? 0.92 : 0.08;
    case "hexagon":
      return isRight ? 0.88 : 0.12;
    default:
      return isRight ? 1 - TEXT_EDGE_MARGIN_RATIO : TEXT_EDGE_MARGIN_RATIO;
  }
}

/**
 * Determines the correct attribution text colour.
 * When markers are shown the text colour is used directly;
 * otherwise a light/dark safe colour is derived from the land luminance.
 */
export function computeAttributionColor(
  textColor: string,
  landHex: string,
  showOverlay: boolean,
): string {
  if (showOverlay) {
    return textColor;
  }
  const landRgb = parseHex(landHex);
  const luma = landRgb ? (0.2126 * landRgb.r + 0.7152 * landRgb.g + 0.0722 * landRgb.b) / 255 : 0.5;
  return luma < 0.52 ? "#f5faff" : "#0e1822";
}
