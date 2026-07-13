import { useEffect } from "react";
import { DEFAULT_LAT, DEFAULT_LON, DEFAULT_CITY, DEFAULT_COUNTRY } from "@/services/config";
import { GEOLOCATION_TIMEOUT_MS } from "@/services/map";
import type { PosterAction } from "@/context/posterReducer";

const FALLBACK_FIELDS = {
  location: "Phnom Penh, Cambodia",
  latitude: DEFAULT_LAT.toFixed(6), longitude: DEFAULT_LON.toFixed(6),
  displayCity: DEFAULT_CITY, displayCountry: DEFAULT_COUNTRY, displayContinent: "Asia",
};

export function useGeolocation(dispatch: React.Dispatch<PosterAction>) {
  useEffect(() => {
    let cancelled = false;
    const fallback = () => {
      if (cancelled) return;
      dispatch({ type: "SET_USER_LOCATION", location: null });
      dispatch({ type: "SET_FORM_FIELDS", resetDisplayNameOverrides: true, fields: FALLBACK_FIELDS });
    };

    if (!navigator.geolocation) { fallback(); return; }

    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lon } }) => {
        if (cancelled) return;
        dispatch({ type: "SET_FORM_FIELDS", resetDisplayNameOverrides: true, fields: { latitude: lat.toFixed(6), longitude: lon.toFixed(6) } });
        dispatch({ type: "SET_USER_LOCATION", location: { id: `user:${lat.toFixed(6)},${lon.toFixed(6)}`, label: "Current Location", shortLabel: "", city: "", country: "", continent: "", lat, lon } });
      },
      fallback,
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: Infinity },
    );
    return () => { cancelled = true; };
  }, [dispatch]);
}
