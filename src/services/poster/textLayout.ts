/**
 * Shared poster text layout constants and pure helpers used by both the live
 * preview overlay and the export canvas renderer.
 */
import { parseHex } from "@/utils/color";
import { shapeSpansAt } from "@/services/poster/clipShapes";
import type { PosterShape } from "@/services/poster/clipShapes";

export const TEXT_DIMENSION_REFERENCE_PX = 3600;

export const TEXT_CITY_Y_RATIO = 0.845;
export const TEXT_DIVIDER_Y_RATIO = 0.875;
export const TEXT_COUNTRY_Y_RATIO = 0.9;
export const TEXT_COORDS_Y_RATIO = 0.93;

/** Margin from the edges for attribution/credits. */
export const TEXT_EDGE_MARGIN_RATIO = 0.005;

/** City text scales down when labels get long. */
const CITY_TEXT_SHRINK_THRESHOLD = 10;

export const CITY_FONT_BASE_PX = 250;
const CITY_FONT_MIN_PX = 110;
export const COUNTRY_FONT_BASE_PX = 92;
export const COORDS_FONT_BASE_PX = 58;
export const ATTRIBUTION_FONT_BASE_PX = 50;

/**
 * Ink bounds of the title block, as a fraction of the font size from its
 * baseline. Used to keep the footer clear of the city/country/coordinates text.
 */
export const TITLE_BAND_TOP_EM = 0.4;
export const TITLE_BAND_BOTTOM_EM = 0.45;

function isLatinScript(text: string | undefined | null): boolean {
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
 * Horizontal nudge (em) for Khmer text in the canvas exporter. On some
 * iOS/WebKit versions the ink-box centering formula leaves Khmer script
 * slightly right of center; a small negative shift moves it left.
 * Tuned by eye against iOS canvas exports.
 */
export const KHMER_OPTICAL_SHIFT_X_EM = -0.12;

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

/** Line box of the footer credits, relative to the credit font size. */
const FOOTER_LINE_HEIGHT_RATIO = 1.15;
/** Space between the two credits when they share a line. */
const FOOTER_SPREAD_GAP_RATIO = 0.9;
/** Clearance kept from the clipped edge of the shape. */
const FOOTER_EDGE_PADDING_RATIO = 0.012;
/** Vertical samples used to find the narrowest span inside a footer band. */
const FOOTER_BAND_SAMPLES = 6;

export interface FooterLayout {
  /** True when the two credits are centred on their own lines. */
  stacked: boolean;
  /** Baseline y for the OpenStreetMap attribution. */
  attributionY: number;
  /** Baseline y for the app credit. */
  creditY: number;
  /** Anchor x for the credit when it shares a line (left aligned). */
  leftX: number;
  /** Anchor x for the attribution when it shares a line (right aligned). */
  rightX: number;
  /** Anchor x used by both lines when stacked (centre aligned). */
  centerX: number;
}

function usableSpan(
  shape: PosterShape,
  width: number,
  height: number,
  top: number,
  bottom: number,
): [number, number] | null {
  let span: [number, number] | null = null;
  for (let i = 0; i <= FOOTER_BAND_SAMPLES; i += 1) {
    const y = top + ((bottom - top) * i) / FOOTER_BAND_SAMPLES;
    const spans = shapeSpansAt(shape, width, height, y);
    if (spans.length === 0) return null;
    let widest = spans[0];
    for (const candidate of spans) {
      if (candidate[1] - candidate[0] > widest[1] - widest[0]) widest = candidate;
    }
    span = span
      ? [Math.max(span[0], widest[0]), Math.min(span[1], widest[1])]
      : [widest[0], widest[1]];
  }
  return span && span[1] > span[0] ? span : null;
}

/**
 * Places the footer credits inside the clipped region of a shape.
 *
 * Shapes such as circle, diamond, star and heart taper towards their bottom
 * edge, so anchoring the credits to the canvas corners hides them. This finds
 * the lowest band of the shape that fits both credits — preferring a single
 * spread line, then two stacked centred lines — without overlapping the title
 * block. Shapes whose usable area sits above the title block get the credits
 * there instead.
 */
export function resolveFooterLayout(options: {
  shape: PosterShape;
  width: number;
  height: number;
  /** Credit font size in pixels. */
  fontSize: number;
  /** Measured width of the app credit, 0 when credits are disabled. */
  leftTextWidth: number;
  /** Measured width of the OpenStreetMap attribution. */
  rightTextWidth: number;
  /** Block occupied by the city/country/coordinates text, in pixels. */
  titleBand?: { top: number; bottom: number };
  marginRatio?: number;
}): FooterLayout {
  const { shape, width, height, fontSize, leftTextWidth, rightTextWidth, titleBand } = options;
  const marginRatio = options.marginRatio ?? TEXT_EDGE_MARGIN_RATIO;

  const lineHeight = fontSize * FOOTER_LINE_HEIGHT_RATIO;
  const padding = Math.min(width, height) * FOOTER_EDGE_PADDING_RATIO;
  const hasCredit = leftTextWidth > 0;
  const spreadNeed =
    leftTextWidth +
    rightTextWidth +
    (hasCredit ? fontSize * FOOTER_SPREAD_GAP_RATIO : 0) +
    padding * 2;
  const stackHeight = lineHeight * 2;
  const bottomLimit = height * (1 - marginRatio);
  const step = Math.max(1, height / 400);

  // Try the strip under the title first (keeps the credits at the bottom edge),
  // then the strip above it for shapes that taper into a point.
  const strips: { maxBottom: number; minTop: number }[] = [];
  if (titleBand && titleBand.bottom < height) {
    strips.push({ maxBottom: bottomLimit, minTop: titleBand.bottom });
  }
  if (titleBand && titleBand.top > 0) {
    strips.push({ maxBottom: Math.min(bottomLimit, titleBand.top), minTop: 0 });
  }
  if (strips.length === 0) {
    strips.push({ maxBottom: bottomLimit, minTop: 0 });
  }

  // Both credits on one line, inset to the shape edges.
  const scanSpread = (strip: { maxBottom: number; minTop: number }) => {
    for (let bottom = strip.maxBottom; bottom - lineHeight >= strip.minTop; bottom -= step) {
      const span = usableSpan(shape, width, height, bottom - lineHeight, bottom);
      if (span && span[1] - span[0] >= spreadNeed) return { bottom, span };
    }
    return null;
  };

  // The credits stacked and centred. Each line is checked against its own band,
  // since shapes widen further from their tapered edge.
  const scanStacked = (strip: { maxBottom: number; minTop: number }) => {
    for (let bottom = strip.maxBottom; bottom - stackHeight >= strip.minTop; bottom -= step) {
      const attributionY = bottom - lineHeight;
      const attributionSpan = usableSpan(
        shape,
        width,
        height,
        attributionY - lineHeight,
        attributionY,
      );
      const creditSpan = usableSpan(shape, width, height, bottom - lineHeight, bottom);
      if (!attributionSpan || !creditSpan) continue;
      const minCenter =
        Math.max(attributionSpan[0] + rightTextWidth / 2, creditSpan[0] + leftTextWidth / 2) +
        padding;
      const maxCenter =
        Math.min(attributionSpan[1] - rightTextWidth / 2, creditSpan[1] - leftTextWidth / 2) -
        padding;
      if (maxCenter >= minCenter) {
        return { attributionY, creditY: bottom, centerX: (minCenter + maxCenter) / 2 };
      }
    }
    return null;
  };

  for (const strip of strips) {
    const spread = scanSpread(strip);
    if (spread) {
      return {
        stacked: false,
        attributionY: spread.bottom,
        creditY: spread.bottom,
        leftX: spread.span[0] + padding,
        rightX: spread.span[1] - padding,
        centerX: (spread.span[0] + spread.span[1]) / 2,
      };
    }

    if (hasCredit) {
      const stacked = scanStacked(strip);
      if (stacked) {
        return {
          stacked: true,
          attributionY: stacked.attributionY,
          creditY: stacked.creditY,
          leftX: stacked.centerX,
          rightX: stacked.centerX,
          centerX: stacked.centerX,
        };
      }
    }
  }

  // Nothing fitted (tiny canvas): keep the credits on the bottom edge, inset to
  // the span available there.
  const span = usableSpan(shape, width, height, bottomLimit - lineHeight, bottomLimit) ?? [
    0,
    width,
  ];
  return {
    stacked: false,
    attributionY: bottomLimit,
    creditY: bottomLimit,
    leftX: span[0] + padding,
    rightX: span[1] - padding,
    centerX: (span[0] + span[1]) / 2,
  };
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
