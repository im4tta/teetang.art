import { useCallback, useEffect, useState } from "react";
import type { MapInstanceRef } from "@/services/map/types";
import { MAP_BUTTON_ZOOM_DURATION_MS } from "@/services/map";

interface UseMapBearingOptions {
  mapRef: MapInstanceRef;
  mapRef2?: MapInstanceRef;
  isDualCity: boolean;
  isMarkerEditorActive: boolean;
}

export function useMapBearing({
  mapRef,
  mapRef2,
  isDualCity,
  isMarkerEditorActive,
}: UseMapBearingOptions) {
  const [mapBearing, setMapBearing] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isRotationEnabled, setIsRotationEnabled] = useState(false);

  // Sync bearing state from the map's rotate events
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => setMapBearing(map.getBearing());
    map.on("rotate", sync);
    return () => {
      map.off("rotate", sync);
    };
  }, [mapRef]);

  // Disable interactions immediately while marker editing and clear latent state
  // from a scheduled callback when marker editing starts.
  useEffect(() => {
    if (!isMarkerEditorActive) return;
    const cleanupFrame = window.requestAnimationFrame(() => {
      setIsEditing(false);
      setIsRotationEnabled(false);
    });
    return () => window.cancelAnimationFrame(cleanupFrame);
  }, [isMarkerEditorActive]);

  const effectiveIsEditing = isEditing && !isMarkerEditorActive;
  const effectiveRotationEnabled = effectiveIsEditing && isRotationEnabled;

  const handleStartEditing = useCallback(() => {
    if (isMarkerEditorActive) return;
    setIsEditing(true);
    const map = mapRef.current;
    if (map) setMapBearing(map.getBearing());
  }, [isMarkerEditorActive, mapRef]);

  const handleFinishEditing = useCallback(() => {
    setIsEditing(false);
    setIsRotationEnabled(false);
  }, []);

  const handleToggleRotation = useCallback(() => setIsRotationEnabled((p) => !p), []);

  const handleRotateBy = useCallback(
    (delta: number) => {
      const map = mapRef.current;
      if (!map) return;
      const next = Math.max(-180, Math.min(180, map.getBearing() + delta));
      setMapBearing(next);
      map.rotateTo(next, { duration: MAP_BUTTON_ZOOM_DURATION_MS });
    },
    [mapRef],
  );

  const handleBearingChange = useCallback(
    (b: number) => {
      const map = mapRef.current;
      if (!map) return;
      const clamped = Math.max(-180, Math.min(180, b));
      setMapBearing(clamped);
      map.rotateTo(clamped, { duration: 0 });
    },
    [mapRef],
  );

  function handleCompassReset() {
    mapRef.current?.rotateTo(0, { duration: MAP_BUTTON_ZOOM_DURATION_MS });
    setMapBearing(0);
    if (isDualCity) mapRef2?.current?.rotateTo(0, { duration: MAP_BUTTON_ZOOM_DURATION_MS });
  }

  return {
    mapBearing,
    isEditing: effectiveIsEditing,
    isRotationEnabled: effectiveRotationEnabled,
    handleStartEditing,
    handleFinishEditing,
    handleToggleRotation,
    handleRotateBy,
    handleBearingChange,
    handleCompassReset,
  };
}
