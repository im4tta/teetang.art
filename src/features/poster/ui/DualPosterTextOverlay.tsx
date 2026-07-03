import { formatCoordinates, formatCoordinatesDMS } from "@/shared/geo/posterBounds";
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
  formatCityLabel,
  computeDualCityFontScale,
  computeAttributionColor,
} from "@/features/poster/domain/textLayout";

interface DualPosterTextOverlayProps {
  city1: string;
  country1: string;
  lat1: number;
  lon1: number;
  city2: string;
  country2: string;
  lat2: number;
  lon2: number;
  fontFamily: string;
  textColor: string;
  textColor2?: string;
  landColor: string;
  showPosterText: boolean;
  includeCredits: boolean;
  showOverlay: boolean;
  showCoordinates: boolean;
  titleAllCaps: boolean;
  showUnderline?: boolean;
  letterSpacing?: string;
  coordsFormat?: string;
}

export default function DualPosterTextOverlay({
  city1,
  country1,
  lat1,
  lon1,
  city2,
  country2,
  lat2,
  lon2,
  fontFamily,
  textColor,
  textColor2,
  landColor,
  showPosterText,
  includeCredits,
  showOverlay,
  showCoordinates,
  titleAllCaps,
  showUnderline = true,
  letterSpacing = "0",
  coordsFormat = "decimal",
}: DualPosterTextOverlayProps) {
  const toCqMin = (px: number) => (px / TEXT_DIMENSION_REFERENCE_PX) * 100;
  const khmerFallback = '"Battambang", "Suwannaphum", serif';
  const titleFont = fontFamily
    ? `"${fontFamily}", ${khmerFallback}, "DM Sans", sans-serif`
    : `"DM Sans", ${khmerFallback}, sans-serif`;
  const bodyFont = fontFamily
    ? `"${fontFamily}", ${khmerFallback}, "Spline Sans Mono", monospace`
    : `"Spline Sans Mono", ${khmerFallback}, monospace`;
  const cityLabel1 = formatCityLabel(city1);
  const cityLabel2 = formatCityLabel(city2);
  const countryLabel1 = titleAllCaps ? country1.toUpperCase() : country1;
  const countryLabel2 = titleAllCaps ? country2.toUpperCase() : country2;
  const cityFontSize = `${toCqMin(CITY_FONT_BASE_PX) * computeDualCityFontScale(city1)}cqmin`;
  const cityFontSize2 = `${toCqMin(CITY_FONT_BASE_PX) * computeDualCityFontScale(city2)}cqmin`;
  const countryFontSize = `${toCqMin(COUNTRY_FONT_BASE_PX)}cqmin`;
  const coordsFontSize = `${toCqMin(COORDS_FONT_BASE_PX)}cqmin`;
  const attributionFontSize = `${toCqMin(ATTRIBUTION_FONT_BASE_PX)}cqmin`;
  const attributionColor = computeAttributionColor(textColor, landColor, showOverlay);
  const attributionOpacity = showOverlay ? 0.55 : 0.9;

  const ls = `${letterSpacing}px`;

  return (
    <div className="poster-text-overlay" style={{ color: textColor }}>
      {showPosterText && (
        <>
          {/* Left side text */}
          <p
            className="poster-city dual-poster-city--left"
            style={{
              fontFamily: titleFont,
              top: `${TEXT_CITY_Y_RATIO * 100}%`,
              fontSize: cityFontSize,
              letterSpacing: ls,
              left: "25%",
              right: "auto",
              transform: "translateX(-50%)",
              margin: 0,
            }}
          >
            {cityLabel1}
          </p>
          {showUnderline && (
            <hr
              className="poster-divider dual-poster-divider--left"
              style={{
                borderColor: textColor,
                top: `${TEXT_DIVIDER_Y_RATIO * 100}%`,
                left: "25%",
                right: "auto",
                width: "14%",
                transform: "translateX(-50%)",
                margin: 0,
              }}
            />
          )}
          <p
            className="poster-country dual-poster-country--left"
            style={{
              fontFamily: titleFont,
              top: `${TEXT_COUNTRY_Y_RATIO * 100}%`,
              fontSize: countryFontSize,
              letterSpacing: ls,
              left: "25%",
              right: "auto",
              transform: "translateX(-50%)",
              margin: 0,
            }}
          >
            {countryLabel1}
          </p>
          {showCoordinates && (
            <p
              className="poster-coords dual-poster-coords--left"
              style={{
                fontFamily: bodyFont,
                top: `${TEXT_COORDS_Y_RATIO * 100}%`,
                fontSize: coordsFontSize,
                letterSpacing: ls,
                left: "25%",
                right: "auto",
                transform: "translateX(-50%)",
                margin: 0,
              }}
            >
              {coordsFormat === "dms"
                ? formatCoordinatesDMS(lat1, lon1)
                : formatCoordinates(lat1, lon1)}
            </p>
          )}

          {/* Center ampersand */}
          <p
            className="dual-poster-ampersand"
            style={{
              fontFamily: titleFont,
              top: `${TEXT_COUNTRY_Y_RATIO * 100}%`,
              fontSize: `${toCqMin(COUNTRY_FONT_BASE_PX * 1.5)}cqmin`,
              letterSpacing: ls,
              left: "50%",
              transform: "translate(-50%, -50%)",
              position: "absolute",
              color: textColor,
              margin: 0,
            }}
          >
            &amp;
          </p>

          {/* Right side text */}
          <p
            className="poster-city dual-poster-city--right"
            style={{
              fontFamily: titleFont,
              top: `${TEXT_CITY_Y_RATIO * 100}%`,
              fontSize: cityFontSize2,
              letterSpacing: ls,
              left: "75%",
              right: "auto",
              transform: "translateX(-50%)",
              margin: 0,
              color: textColor2 ?? textColor,
            }}
          >
            {cityLabel2}
          </p>
          {showUnderline && (
            <hr
              className="poster-divider dual-poster-divider--right"
              style={{
                borderColor: textColor2 ?? textColor,
                top: `${TEXT_DIVIDER_Y_RATIO * 100}%`,
                left: "75%",
                right: "auto",
                width: "14%",
                transform: "translateX(-50%)",
                margin: 0,
              }}
            />
          )}
          <p
            className="poster-country dual-poster-country--right"
            style={{
              fontFamily: titleFont,
              top: `${TEXT_COUNTRY_Y_RATIO * 100}%`,
              fontSize: countryFontSize,
              letterSpacing: ls,
              left: "75%",
              right: "auto",
              transform: "translateX(-50%)",
              margin: 0,
              color: textColor2 ?? textColor,
            }}
          >
            {countryLabel2}
          </p>
          {showCoordinates && (
            <p
              className="poster-coords dual-poster-coords--right"
              style={{
                fontFamily: bodyFont,
                top: `${TEXT_COORDS_Y_RATIO * 100}%`,
                fontSize: coordsFontSize,
                letterSpacing: ls,
                left: "75%",
                right: "auto",
                transform: "translateX(-50%)",
                margin: 0,
                color: textColor2 ?? textColor,
              }}
            >
              {coordsFormat === "dms"
                ? formatCoordinatesDMS(lat2, lon2)
                : formatCoordinates(lat2, lon2)}
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
          bottom: "2%",
          right: "3%",
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
            bottom: "2%",
            left: "3%",
          }}
        >
          © teetang.art
        </span>
      )}
    </div>
  );
}
