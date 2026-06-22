import { formatCoordinates, formatCoordinatesDMS } from "@/shared/geo/posterBounds";
import type { Coordinate } from "@/shared/geo/types";
import { APP_CREDIT_URL } from "@/core/config";
import {
  TEXT_DIMENSION_REFERENCE_PX,
  TEXT_CITY_Y_RATIO,
  TEXT_DIVIDER_Y_RATIO,
  TEXT_COUNTRY_Y_RATIO,
  TEXT_COORDS_Y_RATIO,
  TEXT_EDGE_MARGIN_RATIO,
  CITY_FONT_BASE_PX,
  COUNTRY_FONT_BASE_PX,
  COORDS_FONT_BASE_PX,
  ATTRIBUTION_FONT_BASE_PX,
  formatCityLabel,
  computeCityFontScale,
  computeDualCityFontScale,
  computeAttributionColor,
  getShapeTextYOffset,
  getShapeAttributionX,
} from "@/features/poster/domain/textLayout";
import type { PosterShape } from "@/features/poster/domain/clipShapes";

const TITLE_FONT_FAMILY = '"Space Grotesk", sans-serif';
const BODY_FONT_FAMILY = '"IBM Plex Mono", monospace';

interface DualCityData {
  city: string;
  country: string;
  center: Coordinate;
}

export function drawDualPosterText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: { ui?: { text?: string }; map?: { land?: string } },
  city1: DualCityData,
  city2: DualCityData,
  fontFamily: string | undefined,
  showPosterText: boolean,
  showOverlay: boolean,
  includeCredits: boolean = true,
  letterSpacing: string = "0",
  coordsFormat: string = "decimal",
  showUnderline: boolean = true,
): void {
  const textColor = theme.ui?.text || "#111111";
  const landColor = theme.map?.land || "#808080";
  const attributionColor = computeAttributionColor(textColor, landColor, showOverlay);
  const attributionAlpha = showOverlay ? 0.55 : 0.9;
  const titleFontFamily = fontFamily
    ? `"${fontFamily}", "Space Grotesk", sans-serif`
    : TITLE_FONT_FAMILY;
  const bodyFontFamily = fontFamily
    ? `"${fontFamily}", "IBM Plex Mono", monospace`
    : BODY_FONT_FAMILY;

  const dimScale = Math.max(0.45, Math.min(width, height) / TEXT_DIMENSION_REFERENCE_PX);
  const attributionFontSize = ATTRIBUTION_FONT_BASE_PX * dimScale;

  if (showPosterText) {
    const coordinateFontSize = COORDS_FONT_BASE_PX * dimScale;
    const countryFontSize = COUNTRY_FONT_BASE_PX * dimScale;
    const cityY = height * TEXT_CITY_Y_RATIO;
    const lineY = height * TEXT_DIVIDER_Y_RATIO;
    const countryY = height * TEXT_COUNTRY_Y_RATIO;
    const coordinatesY = height * TEXT_COORDS_Y_RATIO;

    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    ctx.letterSpacing = `${letterSpacing}px`;

    const drawCenteredText = (text: string, cx: number, y: number, font: string) => {
      ctx.font = font;
      ctx.textAlign = "center";
      const metrics = ctx.measureText(text);
      const left = (metrics as any).actualBoundingBoxLeft;
      const right = (metrics as any).actualBoundingBoxRight;
      const baseX =
        typeof left === "number" && typeof right === "number" ? cx - (right - left) / 2 : cx;
      ctx.fillText(text, baseX, y);
    };

    // City 1 (left quarter at 25%)
    const cityLabel1 = formatCityLabel(city1.city);
    const cityFontSize1 = CITY_FONT_BASE_PX * dimScale * computeDualCityFontScale(city1.city);
    drawCenteredText(cityLabel1, width * 0.25, cityY, `700 ${cityFontSize1}px ${titleFontFamily}`);

    if (showUnderline) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 3 * dimScale;
      ctx.beginPath();
      ctx.moveTo(width * 0.18, lineY);
      ctx.lineTo(width * 0.32, lineY);
      ctx.stroke();
    }

    // Country 1
    drawCenteredText(
      city1.country.toUpperCase(),
      width * 0.25,
      countryY,
      `300 ${countryFontSize}px ${titleFontFamily}`,
    );

    // Coords 1
    ctx.globalAlpha = 0.75;
    const coordText1 =
      coordsFormat === "dms"
        ? formatCoordinatesDMS(city1.center.lat, city1.center.lon)
        : formatCoordinates(city1.center.lat, city1.center.lon);
    drawCenteredText(
      coordText1,
      width * 0.25,
      coordinatesY,
      `400 ${coordinateFontSize}px ${bodyFontFamily}`,
    );
    ctx.globalAlpha = 1;

    // Ampersand in center
    const ampersandFontSize = COUNTRY_FONT_BASE_PX * dimScale * 1.5;
    drawCenteredText("&", width * 0.5, countryY, `300 ${ampersandFontSize}px ${titleFontFamily}`);

    // City 2 (right quarter at 75%)
    const cityLabel2 = formatCityLabel(city2.city);
    const cityFontSize2 = CITY_FONT_BASE_PX * dimScale * computeDualCityFontScale(city2.city);
    drawCenteredText(cityLabel2, width * 0.75, cityY, `700 ${cityFontSize2}px ${titleFontFamily}`);

    if (showUnderline) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 3 * dimScale;
      ctx.beginPath();
      ctx.moveTo(width * 0.68, lineY);
      ctx.lineTo(width * 0.82, lineY);
      ctx.stroke();
    }

    // Country 2
    drawCenteredText(
      city2.country.toUpperCase(),
      width * 0.75,
      countryY,
      `300 ${countryFontSize}px ${titleFontFamily}`,
    );

    // Coords 2
    ctx.globalAlpha = 0.75;
    const coordText2 =
      coordsFormat === "dms"
        ? formatCoordinatesDMS(city2.center.lat, city2.center.lon)
        : formatCoordinates(city2.center.lat, city2.center.lon);
    drawCenteredText(
      coordText2,
      width * 0.75,
      coordinatesY,
      `400 ${coordinateFontSize}px ${bodyFontFamily}`,
    );
    ctx.globalAlpha = 1;
  }

  const attrRightX = width * (1 - TEXT_EDGE_MARGIN_RATIO);
  const attrLeftX = width * TEXT_EDGE_MARGIN_RATIO;
  const attrY = height * (1 - TEXT_EDGE_MARGIN_RATIO);

  ctx.fillStyle = attributionColor;
  ctx.globalAlpha = attributionAlpha;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.letterSpacing = "0px";
  ctx.font = `300 ${attributionFontSize}px ${bodyFontFamily}`;
  ctx.fillText("\u00a9 OpenStreetMap contributors", attrRightX, attrY);
  ctx.globalAlpha = 1;

  if (includeCredits) {
    ctx.fillStyle = attributionColor;
    ctx.globalAlpha = attributionAlpha;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.letterSpacing = "0px";
    ctx.font = `300 ${attributionFontSize}px ${bodyFontFamily}`;
    ctx.fillText(`\u00a9 ${APP_CREDIT_URL}`, attrLeftX, attrY);
    ctx.globalAlpha = 1;
  }
}

export function drawPosterText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: { ui?: { text?: string }; map?: { land?: string } },
  center: Coordinate,
  city: string,
  country: string,
  fontFamily: string | undefined,
  showPosterText: boolean,
  showOverlay: boolean,
  includeCredits: boolean = true,
  shape: PosterShape = "rectangle",
  letterSpacing: string = "0",
  titleAlign: string = "center",
  showUnderline: boolean = true,
  coordsFormat: string = "decimal",
): void {
  const drawTextWithAlignment = (
    text: string,
    xCenter: number,
    y: number,
    _fontSize: number,
    font: string,
  ) => {
    ctx.font = font;
    ctx.letterSpacing = `${letterSpacing}px`;

    let x = xCenter;
    let align: CanvasTextAlign = "center";

    if (titleAlign === "left") {
      x = width * 0.08;
      align = "left";
    } else if (titleAlign === "right") {
      x = width * 0.92;
      align = "right";
    }

    ctx.textAlign = align;

    if (align === "center") {
      const metrics = ctx.measureText(text);
      const left = (metrics as any).actualBoundingBoxLeft;
      const right = (metrics as any).actualBoundingBoxRight;
      const baseX =
        typeof left === "number" && typeof right === "number" ? x - (right - left) / 2 : x;
      ctx.fillText(text, baseX, y);
    } else {
      ctx.fillText(text, x, y);
    }
  };

  const textColor = theme.ui?.text || "#111111";
  const landColor = theme.map?.land || "#808080";
  const attributionColor = computeAttributionColor(textColor, landColor, showOverlay);
  const attributionAlpha = showOverlay ? 0.55 : 0.9;
  const titleFontFamily = fontFamily
    ? `"${fontFamily}", "Space Grotesk", sans-serif`
    : TITLE_FONT_FAMILY;
  const bodyFontFamily = fontFamily
    ? `"${fontFamily}", "IBM Plex Mono", monospace`
    : BODY_FONT_FAMILY;

  const dimScale = Math.max(0.45, Math.min(width, height) / TEXT_DIMENSION_REFERENCE_PX);
  const attributionFontSize = ATTRIBUTION_FONT_BASE_PX * dimScale;
  const yOffset = getShapeTextYOffset(shape) * height;

  if (showPosterText) {
    const cityLabel = formatCityLabel(city);
    const cityFontSize = CITY_FONT_BASE_PX * dimScale * computeCityFontScale(city);

    const countryFontSize = COUNTRY_FONT_BASE_PX * dimScale;
    const coordinateFontSize = COORDS_FONT_BASE_PX * dimScale;
    const cityY = height * TEXT_CITY_Y_RATIO + yOffset;
    const lineY = height * TEXT_DIVIDER_Y_RATIO + yOffset;
    const countryY = height * TEXT_COUNTRY_Y_RATIO + yOffset;
    const coordinatesY = height * TEXT_COORDS_Y_RATIO + yOffset;

    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    const cityFont = `700 ${cityFontSize}px ${titleFontFamily}`;
    drawTextWithAlignment(cityLabel, width * 0.5, cityY, cityFontSize, cityFont);

    if (showUnderline) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 3 * dimScale;
      ctx.beginPath();
      ctx.moveTo(width * 0.4, lineY);
      ctx.lineTo(width * 0.6, lineY);
      ctx.stroke();
    }

    const countryFont = `300 ${countryFontSize}px ${titleFontFamily}`;
    drawTextWithAlignment(
      country.toUpperCase(),
      width * 0.5,
      countryY,
      countryFontSize,
      countryFont,
    );

    ctx.globalAlpha = 0.75;
    const coordFont = `400 ${coordinateFontSize}px ${bodyFontFamily}`;
    const coordText =
      coordsFormat === "dms"
        ? formatCoordinatesDMS(center.lat, center.lon)
        : formatCoordinates(center.lat, center.lon);
    drawTextWithAlignment(coordText, width * 0.5, coordinatesY, coordinateFontSize, coordFont);
    ctx.globalAlpha = 1;
  }

  const attrRightX = width * getShapeAttributionX(shape, true);
  const attrLeftX = width * getShapeAttributionX(shape, false);
  const attrY = height * (1 - TEXT_EDGE_MARGIN_RATIO) + yOffset * 0.5;

  ctx.fillStyle = attributionColor;
  ctx.globalAlpha = attributionAlpha;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.letterSpacing = "0px";
  ctx.font = `300 ${attributionFontSize}px ${bodyFontFamily}`;
  ctx.fillText("\u00a9 OpenStreetMap contributors", attrRightX, attrY);
  ctx.globalAlpha = 1;

  if (includeCredits) {
    ctx.fillStyle = attributionColor;
    ctx.globalAlpha = attributionAlpha;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.letterSpacing = "0px";
    ctx.font = `300 ${attributionFontSize}px ${bodyFontFamily}`;
    ctx.fillText(`© ${APP_CREDIT_URL}`, attrLeftX, attrY);
    ctx.globalAlpha = 1;
  }
}
