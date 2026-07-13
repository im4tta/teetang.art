import { useState, useEffect } from "react";
import type { SearchResult } from "@/services/location/types";
import type { PosterForm } from "@/context/posterReducer";
import {
  PLACEHOLDER_LOCATION_SEARCH,
  PLACEHOLDER_EXAMPLE_LATITUDE,
  PLACEHOLDER_EXAMPLE_LONGITUDE,
} from "@/components/ui/locationSectionConstants";
import { MyLocationIcon, ClockIcon } from "@/components/ui/Icons";
import { readSearchHistory, clearSearchHistory } from "@/utils/searchHistory";

interface LocationSectionProps {
  form: PosterForm;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLocationFocus: () => void;
  onLocationBlur: () => void;
  searchNow: (query: string) => Promise<void>;
  showLocationSuggestions: boolean;
  locationSuggestions: SearchResult[];
  isLocationSearching: boolean;
  onLocationSelect: (suggestion: SearchResult) => void;
  onClearLocation: () => void;
  onUseCurrentLocation: () => void;
  isLocatingUser: boolean;
  locationPermissionMessage: string;
}

export default function LocationSection({
  form,
  onChange,
  onLocationFocus,
  onLocationBlur,
  searchNow,
  showLocationSuggestions,
  locationSuggestions,
  isLocationSearching,
  onLocationSelect,
  onClearLocation,
  onUseCurrentLocation,
  isLocatingUser,
  locationPermissionMessage,
}: LocationSectionProps) {
  const hasLocationValue = form.location.trim().length > 0;
  const [history, setHistory] = useState(readSearchHistory());

  useEffect(() => {
    setHistory(readSearchHistory());
  }, [form.location]);

  const handleHistorySelect = (item: ReturnType<typeof readSearchHistory>[number]) => {
    const synthetic = {
      target: {
        name: "location",
        value: item.label,
      },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(synthetic);
    const latSyn = {
      target: { name: "latitude", value: item.lat },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(latSyn);
    const lonSyn = {
      target: { name: "longitude", value: item.lon },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(lonSyn);
  };

  return (
    <section className="panel-block">
      <h2>Location</h2>
      <label>
        Location
        <div className="location-autocomplete">
          <div className="location-search-row">
            <div className="location-input-wrap">
              <input
                className="form-control-tall"
                name="location"
                value={form.location}
                onChange={onChange}
                onFocus={onLocationFocus}
                onBlur={onLocationBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void searchNow(e.currentTarget.value);
                }}
                placeholder={PLACEHOLDER_LOCATION_SEARCH}
                autoComplete="off"
              />
              {hasLocationValue ? (
                <button
                  type="button"
                  className="location-clear-btn"
                  aria-label="Clear location"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onClearLocation}
                >
                  x
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="location-current-btn"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onUseCurrentLocation}
              disabled={isLocatingUser}
              aria-label="Use current location"
              title="Use current location"
            >
              <MyLocationIcon />
            </button>
          </div>
          {showLocationSuggestions ? (
            <ul className="location-suggestions" role="listbox">
              {locationSuggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    className="location-suggestion"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onLocationSelect(suggestion);
                    }}
                  >
                    {suggestion.label}
                  </button>
                </li>
              ))}
              {isLocationSearching ? (
                <li className="location-suggestion-status">Searching...</li>
              ) : null}
            </ul>
          ) : null}
          {!showLocationSuggestions && history.length > 0 && form.location.trim().length === 0 ? (
            <ul className="location-suggestions" role="listbox">
              <li
                className="location-suggestion-status"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ClockIcon /> Recent searches
                </span>
                <button
                  type="button"
                  className="location-suggestion"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    clearSearchHistory();
                    setHistory([]);
                  }}
                  style={{ padding: "2px 8px", fontSize: "0.65rem" }}
                >
                  Clear
                </button>
              </li>
              {history.map((item, idx) => (
                <li key={`hist-${idx}`}>
                  <button
                    type="button"
                    className="location-suggestion"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleHistorySelect(item);
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {locationPermissionMessage ? (
            <p className="location-permission-message">{locationPermissionMessage}</p>
          ) : null}
        </div>
      </label>
      <div className="field-grid keep-two-mobile">
        <label>
          Latitude (optional)
          <input
            className="form-control-tall"
            name="latitude"
            value={form.latitude}
            onChange={onChange}
            placeholder={PLACEHOLDER_EXAMPLE_LATITUDE}
          />
        </label>
        <label>
          Longitude (optional)
          <input
            className="form-control-tall"
            name="longitude"
            value={form.longitude}
            onChange={onChange}
            placeholder={PLACEHOLDER_EXAMPLE_LONGITUDE}
          />
        </label>
      </div>
    </section>
  );
}
