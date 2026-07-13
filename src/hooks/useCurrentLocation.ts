import { useCallback, useRef, useState } from "react";
import { usePosterDispatch } from "@/context/PosterContext";
import { reverseGeocodeCoordinates } from "@/services/container";
import { DEFAULT_DISTANCE_METERS } from "@/services/config";
import { GEOLOCATION_TIMEOUT_MS } from "@/services/map";
import { getGeolocationFailureMessage, requestCurrentPositionWithRetry } from "@/services/location";
import type { SearchResult } from "@/services/location/types";

export function useCurrentLocation(flyToLocation: (lat: number, lon: number) => void) {
  const { dispatch } = usePosterDispatch();
  const [isLocatingUser, setIsLocating] = useState(false);
  const [locationPermissionMessage, setPermMsg] = useState("");
  const locatingRef = useRef(false);

  const handleUseCurrentLocation = useCallback(() => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setIsLocating(true);
    void (async () => {
      const result = await requestCurrentPositionWithRetry({ timeoutMs: GEOLOCATION_TIMEOUT_MS, maxAttempts: 2 });
      if ("reason" in result) {
        setPermMsg(getGeolocationFailureMessage(result.reason));
        locatingRef.current = false; setIsLocating(false); return;
      }
      const { lat, lon } = result;
      setPermMsg("");
      try {
        flyToLocation(lat, lon);
        dispatch({ type: "SET_FORM_FIELDS", resetDisplayNameOverrides: true, fields: { latitude: lat.toFixed(6), longitude: lon.toFixed(6), distance: String(DEFAULT_DISTANCE_METERS) } });
        try {
          const r = await reverseGeocodeCoordinates(lat, lon);
          dispatch({ type: "SET_FORM_FIELDS", resetDisplayNameOverrides: true, fields: { location: r.label, displayCity: String(r.city ?? "").trim(), displayCountry: String(r.country ?? "").trim(), displayContinent: String(r.continent ?? "").trim() } });
          dispatch({ type: "SET_USER_LOCATION", location: r });
        } catch {
          const fb: SearchResult = { id: `user:${lat.toFixed(6)},${lon.toFixed(6)}`, label: `${lat.toFixed(6)}, ${lon.toFixed(6)}`, shortLabel: "", city: "", country: "", continent: "", lat, lon };
          dispatch({ type: "SET_FORM_FIELDS", resetDisplayNameOverrides: true, fields: { location: fb.label } });
          dispatch({ type: "SET_USER_LOCATION", location: fb });
        }
      } finally { locatingRef.current = false; setIsLocating(false); }
    })();
  }, [flyToLocation, dispatch]);

  return { handleUseCurrentLocation, isLocatingUser, locationPermissionMessage };
}
