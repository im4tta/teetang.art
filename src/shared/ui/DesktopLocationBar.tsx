import { useState } from "react";
import { usePosterContext } from "@/features/poster/ui/PosterContext";
import { useFormHandlers } from "@/features/poster/application/useFormHandlers";
import { useLocationAutocomplete } from "@/features/location/application/useLocationAutocomplete";
import { useCurrentLocation } from "@/features/location/application/useCurrentLocation";
import { useMapSync } from "@/features/map/application/useMapSync";
import {
  PLACEHOLDER_LOCATION_SEARCH,
  PLACEHOLDER_EXAMPLE_LATITUDE,
  PLACEHOLDER_EXAMPLE_LONGITUDE,
} from "@/features/location/ui/constants";
import type { SearchResult } from "@/features/location/domain/types";
import { MyLocationIcon, LocationIcon, SearchIcon } from "@/shared/ui/Icons";

/**
 * Desktop floating location bar.
 * Renders a pill-shaped search row with a search icon on the left,
 * a coords-toggle pin button, and a GPS button on the right.
 * Clicking the pin icon shows/hides the lat/lon coordinate fields.
 */
export default function DesktopLocationBar() {
  const { state, dispatch, mapRef } = usePosterContext();
  const {
    handleChange,
    handleLocationSelect: handleLocationSelectBase,
    handleClearLocation,
    setLocationFocused,
  } = useFormHandlers();
  const { locationSuggestions, isLocationSearching, searchNow } = useLocationAutocomplete(
    state.form.location,
    state.isLocationFocused,
  );
  const { flyToLocation } = useMapSync(state, dispatch, mapRef);
  const { handleUseCurrentLocation, isLocatingUser, locationPermissionMessage } =
    useCurrentLocation(flyToLocation);

  const [showCoords, setShowCoords] = useState(false);

  const hasLocationValue = state.form.location.trim().length > 0;
  const showLocationSuggestions = state.isLocationFocused && locationSuggestions.length > 0;

  const onLocationSelect = (location: SearchResult) => {
    handleLocationSelectBase(location);
    flyToLocation(location.lat, location.lon);
  };

  return (
    <div className={`dsk-loc-bar${showCoords ? " show-coords" : ""}`}>
      <div className="location-autocomplete">
        <div className="location-search-stack">
          <div className="location-search-main-row">
            <div className="location-search-row">
              <span className="location-search-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <div className="location-input-wrap">
                <input
                  className="form-control-tall"
                  name="location"
                  value={state.form.location}
                  onChange={handleChange}
                  onFocus={() => setLocationFocused(true)}
                  onBlur={() => setLocationFocused(false)}
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
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleClearLocation}
                  >
                    x
                  </button>
                ) : null}
              </div>
            </div>

            <div className="location-search-icons">
              <button
                type="button"
                className={`icon-only-btn location-row-icon-btn${isLocatingUser ? " is-locating" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUseCurrentLocation}
                disabled={isLocatingUser}
                aria-label="Use current location"
                title="Use current location"
              >
                <MyLocationIcon className="location-current-icon" />
              </button>
              <button
                type="button"
                className={`icon-only-btn location-row-icon-btn${showCoords ? " is-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowCoords((v) => !v)}
                aria-label="Toggle coordinate fields"
                title="Show/hide lat & lon"
              >
                <LocationIcon />
              </button>
            </div>
          </div>

          {showLocationSuggestions ? (
            <ul className="location-suggestions" role="listbox">
              {locationSuggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    className="location-suggestion"
                    onMouseDown={(e) => {
                      e.preventDefault();
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
        </div>

        {locationPermissionMessage ? (
          <p className="location-permission-message">{locationPermissionMessage}</p>
        ) : null}

        <div className="dsk-loc-coords">
          <label>
            Latitude
            <input
              className="form-control-tall"
              name="latitude"
              value={state.form.latitude}
              onChange={handleChange}
              placeholder={PLACEHOLDER_EXAMPLE_LATITUDE}
            />
          </label>
          <label>
            Longitude
            <input
              className="form-control-tall"
              name="longitude"
              value={state.form.longitude}
              onChange={handleChange}
              placeholder={PLACEHOLDER_EXAMPLE_LONGITUDE}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
