import { formatCoordinates, formatCoordinatesDMS } from "@/shared/geo/posterBounds";
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
  computeAttributionColor,
  getShapeTextYOffset,
  getShapeAttributionX,
} from "@/features/poster/domain/textLayout";
import type { PosterShape } from "@/features/poster/domain/clipShapes";

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
}: PosterTextOverlayProps) {
  const toCqMin = (px: number) => (px / TEXT_DIMENSION_REFERENCE_PX) * 100;

  const titleFont = fontFamily ? `"${fontFamily}", "DM Sans", sans-serif` : '"DM Sans", sans-serif';
  const bodyFont = fontFamily
    ? `"${fontFamily}", "Spline Sans Mono", monospace`
    : '"Spline Sans Mono", monospace';

  const cityLabel = formatCityLabel(city);
  const countryLabel = titleAllCaps ? country.toUpperCase() : country;
  const cityFontSize = `${toCqMin(CITY_FONT_BASE_PX) * computeCityFontScale(city)}cqmin`;
  const countryFontSize = `${toCqMin(COUNTRY_FONT_BASE_PX)}cqmin`;
  const coordsFontSize = `${toCqMin(COORDS_FONT_BASE_PX)}cqmin`;
  const attributionFontSize = `${toCqMin(ATTRIBUTION_FONT_BASE_PX)}cqmin`;
  const attributionColor = computeAttributionColor(textColor, landColor, showOverlay);
  const attributionOpacity = showOverlay ? 0.55 : 0.9;
  const yOffset = getShapeTextYOffset(shape);
  const LIVE_ATTR_EXTRA_MARGIN_RATIO = 0.005;

  const alignmentStyle: React.CSSProperties = {
    textAlign: titleAlign as any,
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
              fontSize: cityFontSize,
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
              fontSize: countryFontSize,
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
                fontSize: coordsFontSize,
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
          fontSize: attributionFontSize,
          bottom: `${(TEXT_EDGE_MARGIN_RATIO + yOffset * 0.5 + LIVE_ATTR_EXTRA_MARGIN_RATIO) * 100}%`,
          right: `${(1 - getShapeAttributionX(shape, true)) * 100}%`,
        }}
      >
        &copy; OpenStreetMap contributors
      </span>

      {includeCredits && (
        <span
          className="poster-credits"
          style={{
            fontFamily: bodyFont,
            color: attributionColor,
            opacity: attributionOpacity,
            fontSize: attributionFontSize,
            bottom: `${(TEXT_EDGE_MARGIN_RATIO + yOffset * 0.5 + LIVE_ATTR_EXTRA_MARGIN_RATIO) * 100}%`,
            left: `${getShapeAttributionX(shape, false) * 100}%`,
          }}
        >
          © {APP_CREDIT_URL}
        </span>
      )}
    </div>
  );
}
