import { useCallback, useEffect, useRef } from "react";
import { reverseGeocodeCoordinates } from "@/services/container";

export interface ReverseGeocodeResult {
  city: string;
  country: string;
  continent: string;
  label: string;
}

interface Options {
  /** Minimum gap between network lookups. */
  minIntervalMs?: number;
  /** Ignore moves smaller than this, in degrees. */
  minDeltaDeg?: number;
}

/**
 * Reverse geocoding for map interactions.
 *
 * Two guards matter here and both were missing on the dual-city map before this
 * was extracted: a throttle so a drag does not fire a request per `moveend`, and
 * a sequence check so a slow earlier response cannot overwrite a newer one.
 */
export function useThrottledReverseGeocode(
  onResult: (result: ReverseGeocodeResult) => void,
  { minIntervalMs = 2000, minDeltaDeg = 0.002 }: Options = {},
): (lat: number, lon: number) => void {
  const lastLookupAtRef = useRef(0);
  const lastLookupCoordsRef = useRef<[number, number] | null>(null);
  const latestSeqRef = useRef(0);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  return useCallback(
    (lat: number, lon: number) => {
      const now = Date.now();
      const prev = lastLookupCoordsRef.current;
      if (prev && Math.abs(prev[0] - lat) < minDeltaDeg && Math.abs(prev[1] - lon) < minDeltaDeg) {
        return;
      }
      if (now - lastLookupAtRef.current < minIntervalMs) return;

      lastLookupCoordsRef.current = [lat, lon];
      lastLookupAtRef.current = now;
      const seq = ++latestSeqRef.current;

      void reverseGeocodeCoordinates(lat, lon)
        .then((r) => {
          // A newer lookup already started; this response is stale.
          if (seq !== latestSeqRef.current) return;
          onResultRef.current({
            city: String(r.city ?? "").trim(),
            country: String(r.country ?? "").trim(),
            continent: String(r.continent ?? "").trim(),
            label: String(r.label ?? "").trim(),
          });
        })
        .catch(() => {});
    },
    [minIntervalMs, minDeltaDeg],
  );
}
