import { useCallback, useState } from "react";
import type { PosterForm } from "@/context/posterReducer";
import type { SearchResult } from "@/services/location/types";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";
import { usePosterContext } from "@/context/PosterContext";
import { useI18n } from "@/context/i18n/context";
import { themeOptions } from "@/services/theme/themeRepository";
import { MapPin } from "lucide-react";

interface DualCitySectionProps {
  form: PosterForm;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onTheme2Change?: (themeId: string) => void;
}

export default function DualCitySection({ form, onChange, onTheme2Change }: DualCitySectionProps) {
  const { t } = useI18n();
  const { dispatch } = usePosterContext();
  const isDualCity = form.layoutMode === "dual-city";

  const [isLocation2Focused, setIsLocation2Focused] = useState(false);
  const {
    locationSuggestions: location2Suggestions,
    isLocationSearching: isLocation2Searching,
    searchNow: searchNow2,
  } = useLocationAutocomplete(form.location2, isLocation2Focused);
  const showLocation2Suggestions = isLocation2Focused && location2Suggestions.length > 0;

  const handleLocation2Select = useCallback(
    (suggestion: SearchResult) => {
      const isSettlement = suggestion.placeType
        ? ["city", "town", "village", "hamlet", "municipality", "locality"].includes(
            suggestion.placeType,
          )
        : true;
      const displayCity = isSettlement ? suggestion.city : suggestion.shortLabel;
      dispatch({
        type: "SET_FORM_FIELDS",
        fields: {
          location2: suggestion.label,
          latitude2: suggestion.lat.toFixed(6),
          longitude2: suggestion.lon.toFixed(6),
          displayCity2: displayCity,
          displayCountry2: suggestion.country,
          displayContinent2: suggestion.continent || "",
        },
      });
      setIsLocation2Focused(false);
    },
    [dispatch],
  );

  const handleToggleDualCity = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const nextMode = isDualCity ? "poster" : "dual-city";
    const syntheticEvent = {
      target: { name: "layoutMode", value: nextMode },
    } as React.ChangeEvent<HTMLSelectElement>;
    onChange(syntheticEvent);
  };

  const handleClearLocation2 = () => {
    dispatch({
      type: "SET_FORM_FIELDS",
      fields: {
        location2: "",
        latitude2: "",
        longitude2: "",
        displayCity2: "",
        displayCountry2: "",
        displayContinent2: "",
      },
    });
  };

  return (
    <section className="panel-block">
      {/* Enable toggle */}
      <div className="ios-toggle-row" style={{ marginBottom: 16 }}>
        <span className="ios-toggle-label" style={{ fontWeight: 600 }}>
          <MapPin
            size={14}
            style={{ display: "inline", marginRight: 6, verticalAlign: "text-bottom" }}
          />
          {t("dualCity.enable")}
        </span>
        <label className="ios-toggle">
          <input type="checkbox" checked={isDualCity} onChange={handleToggleDualCity} />
          <span className="ios-track" />
        </label>
      </div>

      {!isDualCity ? (
        <p
          className="section-summary-label"
          style={{ color: "#94A3B8", textAlign: "center", padding: "16px 0" }}
        >
          {t("dualCity.description")}
        </p>
      ) : (
        <>
          <label style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "#94A3B8", marginBottom: 4, display: "block" }}>
              {t("dualCity.secondTheme")}
            </span>
            <select
              className="form-control-tall"
              value={form.theme2 || form.theme}
              onChange={(e) => onTheme2Change?.(e.target.value)}
            >
              {themeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <p className="section-summary-label">{t("location.chooseLocation")}</p>

          {/* Location search */}
          <label>
            <div className="location-autocomplete">
              <div className="location-input-wrap">
                <input
                  className="form-control-tall"
                  name="location2"
                  value={form.location2}
                  onChange={onChange}
                  onFocus={() => setIsLocation2Focused(true)}
                  onBlur={() => setIsLocation2Focused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void searchNow2(e.currentTarget.value);
                  }}
                  placeholder={t("dualCity.searchPlaceholder")}
                  autoComplete="off"
                />
                {form.location2.trim().length > 0 ? (
                  <button
                    type="button"
                    className="location-clear-btn"
                    aria-label={t("location.clearLocation")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleClearLocation2}
                  >
                    x
                  </button>
                ) : null}
              </div>
              {showLocation2Suggestions ? (
                <ul className="location-suggestions" role="listbox">
                  {location2Suggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <button
                        type="button"
                        className="location-suggestion"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleLocation2Select(suggestion);
                        }}
                      >
                        {suggestion.label}
                      </button>
                    </li>
                  ))}
                  {isLocation2Searching ? (
                    <li className="location-suggestion-status">{t("location.searching")}</li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          </label>

          {/* Coordinates */}
          <div className="field-grid keep-two-mobile">
            <label>
              {t("location.latitude")}
              <input
                className="form-control-tall"
                name="latitude2"
                value={form.latitude2}
                onChange={onChange}
                placeholder="11.5564"
              />
            </label>
            <label>
              {t("location.longitude")}
              <input
                className="form-control-tall"
                name="longitude2"
                value={form.longitude2}
                onChange={onChange}
                placeholder="104.9282"
              />
            </label>
          </div>

          {/* Display names */}
          <div className="field-grid keep-two-mobile">
            <label>
              {t("poster.displayCity")}
              <input
                className="form-control-tall"
                name="displayCity2"
                value={form.displayCity2}
                onChange={onChange}
                placeholder="Phnom Penh"
              />
            </label>
            <label>
              {t("poster.displayCountry")}
              <input
                className="form-control-tall"
                name="displayCountry2"
                value={form.displayCountry2}
                onChange={onChange}
                placeholder="Cambodia"
              />
            </label>
          </div>
        </>
      )}
    </section>
  );
}
