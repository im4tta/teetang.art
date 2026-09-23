import { formatCoordinates, formatCoordinatesDMS } from "@/utils/geo/posterBounds";
import { APP_CREDIT_URL } from "@/services/config";
import {
  TEXT_DIMENSION_REFERENCE_PX,
  TEXT_CITY_Y_RATIO,
  TEXT_DIVIDER_Y_RATIO,
  TEXT_COUNTRY_Y_RATIO,
  TEXT_COORDS_Y_RATIO,
  CITY_FONT_BASE_PX,
  COUNTRY_FONT_BASE_PX,
  COORDS_FONT_BASE_PX,
  ATTRIBUTION_FONT_BASE_PX,
  TITLE_BAND_TOP_EM,
  TITLE_BAND_BOTTOM_EM,
  formatCityLabel,
  computeCityFontScale,
  computeAttributionColor,
  getShapeTextYOffset,
  resolveFooterLayout,
} from "@/services/poster/textLayout";
import type { PosterShape } from "@/services/poster/clipShapes";

const OSM_ATTRIBUTION = "\u00a9 OpenStreetMap contributors";

let footerMeasureCtx: CanvasRenderingContext2D | null | undefined;

function measureFooterText(text: string, font: string): number {
  if (footerMeasureCtx === undefined) {
    footerMeasureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!footerMeasureCtx) return 0;
  footerMeasureCtx.font = font;
  return footerMeasureCtx.measureText(text).width;
}

interface PosterTextOverlayProps {
  city: string;
  country: string;
  lat: number;
  lon: number;
  fontFamily: string;
  textColor: string;
  landColor: string;
  showPosterText: boolean;
  includeCredits: boolean;
  showOverlay: boolean;
  showCoordinates: boolean;
  titleAllCaps: boolean;
  showUnderline?: boolean;
  shape?: PosterShape;
  aspect?: number;
  letterSpacing?: string;
  titleAlign?: string;
  coordsFormat?: string;
}

/**
 * DOM-based poster text overlay (sharp at any resolution, GPU-composited).
 * Renders city name, divider, country, coordinates, and attribution
 * positioned to match the canvas export layout exactly.
 */
export default function PosterTextOverlay({
  city,
  country,
  lat,
  lon,
  fontFamily,
  textColor,
  landColor,
  showPosterText,
  includeCredits,
  showOverlay,
  showCoordinates,
  titleAllCaps,
  shape = "rectangle",
  letterSpacing = "0",
  titleAlign = "center",
  showUnderline = true,
  coordsFormat = "decimal",
  aspect = 1,
}: PosterTextOverlayProps) {
  const toCqMin = (px: number) => (px / TEXT_DIMENSION_REFERENCE_PX) * 100;

  const khmerFallback = '"Battambang", "Suwannaphum", serif';
  const titleFont = fontFamily
    ? `"${fontFamily}", ${khmerFallback}, "DM Sans", sans-serif`
    : `"DM Sans", ${khmerFallback}, sans-serif`;
  const bodyFont = fontFamily
    ? `"${fontFamily}", ${khmerFallback}, "Spline Sans Mono", monospace`
    : `"Spline Sans Mono", ${khmerFallback}, monospace`;

  const cityLabel = formatCityLabel(city);
  const countryLabel = titleAllCaps ? country.toUpperCase() : country;
  const cityFontUnits = toCqMin(CITY_FONT_BASE_PX) * computeCityFontScale(city);
  const countryFontUnits = toCqMin(COUNTRY_FONT_BASE_PX);
  const coordsFontUnits = toCqMin(COORDS_FONT_BASE_PX);
  const attributionFontUnits = toCqMin(ATTRIBUTION_FONT_BASE_PX);
  const attributionColor = computeAttributionColor(textColor, landColor, showOverlay);
  const attributionOpacity = showOverlay ? 0.55 : 0.9;
  const yOffset = getShapeTextYOffset(shape);

  // Solve the footer in the 0.01cqmin unit space the CSS above uses, so the
  // preview and the canvas export agree on where the credits end up.
  const posterAspect = shape === "rectangle" || shape === "rounded" ? aspect : 1;
  const widthUnits = posterAspect >= 1 ? 100 * posterAspect : 100;
  const heightUnits = posterAspect >= 1 ? 100 : 100 / posterAspect;
  const creditLabel = `\u00a9 ${APP_CREDIT_URL}`;
  const measureFont = `300 100px ${bodyFont}`;
  const emToUnits = (text: string) =>
    (measureFooterText(text, measureFont) / 100) * attributionFontUnits;
  const footer = resolveFooterLayout({
    shape,
    width: widthUnits,
    height: heightUnits,
    fontSize: attributionFontUnits,
    leftTextWidth: includeCredits ? emToUnits(creditLabel) : 0,
    rightTextWidth: emToUnits(OSM_ATTRIBUTION),
    titleBand: showPosterText
      ? {
          top: (TEXT_CITY_Y_RATIO + yOffset) * heightUnits - cityFontUnits * TITLE_BAND_TOP_EM,
          bottom:
            (TEXT_COORDS_Y_RATIO + yOffset) * heightUnits + coordsFontUnits * TITLE_BAND_BOTTOM_EM,
        }
      : undefined,
  });
  const attributionBottom = `${(1 - footer.attributionY / heightUnits) * 100}%`;
  const creditBottom = `${(1 - footer.creditY / heightUnits) * 100}%`;
  const spreadRight = `${(1 - footer.rightX / widthUnits) * 100}%`;
  const spreadLeft = `${(footer.leftX / widthUnits) * 100}%`;
  const stackedCenter = `${(footer.centerX / widthUnits) * 100}%`;

  const alignmentStyle: React.CSSProperties = {
    textAlign: titleAlign as React.CSSProperties["textAlign"],
    paddingLeft: titleAlign === "left" ? "8%" : "0",
    paddingRight: titleAlign === "right" ? "8%" : "0",
  };

  const ls = `${letterSpacing}px`;

  return (
    <div className="poster-text-overlay" style={{ color: textColor }}>
      {showPosterText && (
        <>
          <p
            className="poster-city"
            style={{
              fontFamily: titleFont,
              top: `${(TEXT_CITY_Y_RATIO + yOffset) * 100}%`,
              fontSize: `${cityFontUnits}cqmin`,
              letterSpacing: ls,
              ...alignmentStyle,
            }}
          >
            {cityLabel}
          </p>
          {showUnderline && (
            <hr
              className="poster-divider"
              style={{
                borderColor: textColor,
                top: `${(TEXT_DIVIDER_Y_RATIO + yOffset) * 100}%`,
              }}
            />
          )}
          <p
            className="poster-country"
            style={{
              fontFamily: titleFont,
              top: `${(TEXT_COUNTRY_Y_RATIO + yOffset) * 100}%`,
              fontSize: `${countryFontUnits}cqmin`,
              letterSpacing: ls,
              ...alignmentStyle,
            }}
          >
            {countryLabel}
          </p>
          {showCoordinates && (
            <p
              className="poster-coords"
              style={{
                fontFamily: bodyFont,
                top: `${(TEXT_COORDS_Y_RATIO + yOffset) * 100}%`,
                fontSize: `${coordsFontUnits}cqmin`,
                letterSpacing: ls,
                ...alignmentStyle,
              }}
            >
              {coordsFormat === "dms"
                ? formatCoordinatesDMS(lat, lon)
                : formatCoordinates(lat, lon)}
            </p>
          )}
        </>
      )}

      <span
        className="poster-attribution"
        style={{
          fontFamily: bodyFont,
          color: attributionColor,
          opacity: attributionOpacity,
          fontSize: `${attributionFontUnits}cqmin`,
          bottom: attributionBottom,
          ...(footer.stacked
            ? { left: stackedCenter, transform: "translateX(-50%)", textAlign: "center" as const }
            : { right: spreadRight, textAlign: "right" as const }),
        }}
      >
        {OSM_ATTRIBUTION}
      </span>

      {includeCredits && (
        <span
          className="poster-credits"
          style={{
            fontFamily: bodyFont,
            color: attributionColor,
            opacity: attributionOpacity,
            fontSize: `${attributionFontUnits}cqmin`,
            bottom: creditBottom,
            ...(footer.stacked
              ? {
                  left: stackedCenter,
                  transform: "translateX(-50%)",
                  textAlign: "center" as const,
                }
              : { left: spreadLeft, textAlign: "left" as const }),
          }}
        >
          {creditLabel}
        </span>
      )}
    </div>
  );
}
