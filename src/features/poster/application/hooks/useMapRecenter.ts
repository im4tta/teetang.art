import { useCallback } from "react";
import type { MapInstanceRef } from "@/features/map/domain/types";
import type { SearchResult } from "@/features/location/domain/types";
import { reverseGeocodeCoordinates } from "@/core/services";
import { DEFAULT_DISTANCE_METERS, DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY, DEFAULT_COUNTRY } from "@/core/config";
import type { PosterAction } from "../posterReducer";

const DEFAULT_LOCATION_LABEL = "Phnom Penh, Cambodia";

interface UseMapRecenterOptions {
  mapRef: MapInstanceRef;
  mapRef2?: MapInstanceRef;
  isDualCity: boolean;
  /** Pre-computed center/zoom for the second map panel (dual-city mode). */
  mapCenter2: [number, number];
  mapZoom2: number;
  selectedLocation: SearchResult | null;
  userLocation: SearchResult | null;
  dispatch: React.Dispatch<PosterAction>;
  /** Called after recenter to reset bearing display. */
  onBearingReset: () => void;
}

export function useMapRecenter({
  mapRef,
  mapRef2,
  isDualCity,
  mapCenter2,
  mapZoom2,
  selectedLocation,
  userLocation,
  dispatch,
  onBearingReset,
}: UseMapRecenterOptions) {
  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isDualCity) {
      const m2 = mapRef2?.current;
      if (m2) m2.stop(), m2.jumpTo({ center: mapCenter2, zoom: mapZoom2, bearing: 0, pitch: 0 });
    }

    const target =
      selectedLocation ||
      userLocation || {
        id: "fallback",
        label: DEFAULT_LOCATION_LABEL,
        shortLabel: DEFAULT_CITY,
        city: DEFAULT_CITY,
        country: DEFAULT_COUNTRY,
        continent: "Asia",
        lat: DEFAULT_LAT,
        lon: DEFAULT_LON,
      };

    const city = String(target.city ?? "").trim();
    const country = String(target.country ?? "").trim();
    const continent = String(target.continent ?? "").trim();
    const label = String(target.label ?? "").trim() || DEFAULT_LOCATION_LABEL;
    const shortLabel = String((target as any).shortLabel ?? "").trim();

    map.stop();
    map.jumpTo({ bearing: 0, pitch: 0 });
    onBearingReset();

    const buildFields = (c: string, co: string, ct: string, l: string, footer: string) => ({
      location: l,
      latitude: target.lat.toFixed(6),
      longitude: target.lon.toFixed(6),
      distance: String(DEFAULT_DISTANCE_METERS),
      displayCity: c,
      displayCountry: co,
      displayContinent: ct,
      footerCity: footer || c,
      footerCountry: co,
    });

    if (city && country) {
      dispatch({
        type: "SET_FORM_FIELDS",
        resetDisplayNameOverrides: true,
        fields: buildFields(city, country, continent || "Asia", label, shortLabel),
      });
      return;
    }

    dispatch({
      type: "SET_FORM_FIELDS",
      resetDisplayNameOverrides: true,
      fields: buildFields(DEFAULT_CITY, DEFAULT_COUNTRY, "Asia", label, shortLabel),
    });

    void reverseGeocodeCoordinates(target.lat, target.lon).then(r => {
      dispatch({ type: "SET_USER_LOCATION", location: r });
      const rc = String(r.city ?? "").trim() || DEFAULT_CITY;
      const rs = String((r as any).shortLabel ?? "").trim();
      dispatch({
        type: "SET_FORM_FIELDS",
        resetDisplayNameOverrides: true,
        fields: {
          displayCity: rc,
          displayCountry: String(r.country ?? "").trim() || DEFAULT_COUNTRY,
          displayContinent: String(r.continent ?? "").trim() || "Asia",
          footerCity: rs || rc,
          footerCountry: String(r.country ?? "").trim() || DEFAULT_COUNTRY,
        },
      });
    });
  }, [
    mapRef, mapRef2, isDualCity, mapCenter2, mapZoom2,
    selectedLocation, userLocation, dispatch, onBearingReset,
  ]);

  return { handleRecenter };
}
