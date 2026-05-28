import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "@/shared/geo/math";
import { reverseGeocodeCoordinates } from "@/core/services";
import type { MapInstanceRef } from "@/features/map/domain/types";
import { MIN_DISTANCE_METERS, MAX_DISTANCE_METERS, EARTH_CIRCUMFERENCE_M, TILE_SIZE_PX, MIN_MAP_ZOOM, MAX_MAP_ZOOM, DEFAULT_CONTAINER_PX, FLY_TO_DURATION_MS } from "@/core/config";
import { MAP_OVERZOOM_SCALE, MIN_EFFECTIVE_CONTAINER_PX, MAX_OVERZOOM_SCALE } from "@/features/map/infrastructure/constants";

export function distanceToZoom(distanceMeters: number, latDeg: number, containerPx: number): number {
  const cosLat = Math.max(0.01, Math.cos((Math.abs(latDeg) * Math.PI) / 180));
  return clamp(Math.log2((EARTH_CIRCUMFERENCE_M * cosLat * containerPx) / (distanceMeters * 2 * TILE_SIZE_PX)), MIN_MAP_ZOOM, MAX_MAP_ZOOM);
}

export function zoomToDistance(zoom: number, latDeg: number, containerPx: number): number {
  const cosLat = Math.max(0.01, Math.cos((Math.abs(latDeg) * Math.PI) / 180));
  return clamp(Math.round((EARTH_CIRCUMFERENCE_M * cosLat * containerPx) / (2 ** zoom * TILE_SIZE_PX * 2)), MIN_DISTANCE_METERS, MAX_DISTANCE_METERS);
}

export function resolveZoomBounds(latDeg: number, containerPx: number) {
  const a = distanceToZoom(MAX_DISTANCE_METERS, latDeg, containerPx);
  const b = distanceToZoom(MIN_DISTANCE_METERS, latDeg, containerPx);
  return { minZoom: Math.min(a, b), maxZoom: Math.max(a, b) };
}

interface MapSyncState {
  form: { latitude: string; longitude: string; distance: string };
  displayNameOverrides: { city: boolean; country: boolean };
  selectedLocation: { label?: string; city?: string; country?: string; continent?: string } | null;
}
type MapSyncDispatch = (a: { type: "SET_FORM_FIELDS"; fields: Partial<Record<string, string>>; resetDisplayNameOverrides?: boolean }) => void;

export function useMapSync(state: MapSyncState, dispatch: MapSyncDispatch, mapRef: MapInstanceRef) {
  const { form } = state;
  const lastLookupAtRef = useRef(0);
  const lastLookupCoordsRef = useRef<[number, number] | null>(null);
  const latestSeqRef = useRef(0);
  const skippedRef = useRef("");
  const lastManualRef = useRef("");
  const selectedLocationRef = useRef(state.selectedLocation);
  selectedLocationRef.current = state.selectedLocation;

  const [containerPx, setContainerPxRaw] = useState(DEFAULT_CONTAINER_PX);
  const overzoomScale = Math.min(MAX_OVERZOOM_SCALE, Math.max(MAP_OVERZOOM_SCALE, MIN_EFFECTIVE_CONTAINER_PX / containerPx));
  const effectivePx = containerPx * overzoomScale;

  const setContainerWidth = useCallback((px: number) => {
    if (px > 0) setContainerPxRaw(prev => Math.abs(prev - px) < 0.5 ? prev : px);
  }, []);

  const formLat = Number(form.latitude) || 0;
  const formLon = Number(form.longitude) || 0;
  const formDistance = clamp(Number(form.distance) || MIN_DISTANCE_METERS, MIN_DISTANCE_METERS, MAX_DISTANCE_METERS);
  const zoomBounds = useMemo(() => resolveZoomBounds(formLat, effectivePx), [formLat, effectivePx]);
  const mapCenter = useMemo<[number, number]>(() => [formLon, formLat], [formLon, formLat]);
  const mapZoom = useMemo(() => clamp(distanceToZoom(formDistance, formLat, effectivePx), zoomBounds.minZoom, zoomBounds.maxZoom), [formDistance, formLat, effectivePx, zoomBounds]);

  const updateFromCoords = useCallback((lat: number, lon: number) => {
    const now = Date.now();
    const prev = lastLookupCoordsRef.current;
    if (prev && Math.abs(prev[0] - lat) < 0.002 && Math.abs(prev[1] - lon) < 0.002) return;
    if (now - lastLookupAtRef.current < 2000) return;
    lastLookupCoordsRef.current = [lat, lon];
    lastLookupAtRef.current = now;
    const seq = ++latestSeqRef.current;
    void reverseGeocodeCoordinates(lat, lon).then(r => {
      if (seq !== latestSeqRef.current) return;
      const city = String(r.city ?? "").trim();
      const country = String(r.country ?? "").trim();
      const continent = String(r.continent ?? "").trim();
      const location = [city, country].filter(Boolean).join(", ") || String(r.label ?? "").trim();
      if (!location) return;
      dispatch({ type: "SET_FORM_FIELDS", fields: {
        location, displayContinent: continent,
        ...(!state.displayNameOverrides.city ? { displayCity: city } : {}),
        ...(!state.displayNameOverrides.country ? { displayCountry: country } : {}),
      }});
    }).catch(() => {});
  }, [dispatch, state.displayNameOverrides.city, state.displayNameOverrides.country]);

  const handleMove = useCallback((_: [number, number]) => {}, []);

  const handleMoveEnd = useCallback((center: [number, number], zoom: number) => {
    const [lon, lat] = center;
    const bounds = resolveZoomBounds(lat, effectivePx);
    const distance = zoomToDistance(clamp(zoom, bounds.minZoom, bounds.maxZoom), lat, effectivePx);
    skippedRef.current = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    dispatch({ type: "SET_FORM_FIELDS", fields: { latitude: lat.toFixed(6), longitude: lon.toFixed(6), distance: String(Math.round(distance)) } });
    updateFromCoords(lat, lon);
  }, [dispatch, effectivePx, updateFromCoords]);

  useEffect(() => {
    const lat = Number(form.latitude), lon = Number(form.longitude);
    if (!form.latitude || !form.longitude || selectedLocationRef.current) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    if (skippedRef.current === key) { skippedRef.current = ""; return; }
    if (lastManualRef.current === key) return;
    const tid = window.setTimeout(() => { lastManualRef.current = key; updateFromCoords(lat, lon); }, 350);
    return () => window.clearTimeout(tid);
  }, [form.latitude, form.longitude, updateFromCoords]);

  const flyToLocation = useCallback((lat: number, lon: number, keepZoom = false) => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = resolveZoomBounds(lat, effectivePx);
    const zoom = keepZoom
      ? clamp(map.getZoom(), bounds.minZoom, bounds.maxZoom)
      : clamp(distanceToZoom(formDistance, lat, effectivePx), bounds.minZoom, bounds.maxZoom);
    map.flyTo({ center: [lon, lat], zoom, duration: FLY_TO_DURATION_MS });
  }, [mapRef, formDistance, effectivePx]);

  return { mapCenter, mapZoom, mapMinZoom: zoomBounds.minZoom, mapMaxZoom: zoomBounds.maxZoom, handleMove, handleMoveEnd, flyToLocation, setContainerWidth, overzoomScale };
}
