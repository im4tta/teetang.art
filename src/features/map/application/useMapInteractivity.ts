import { useEffect } from "react";
import maplibregl from "maplibre-gl";

interface UseMapInteractivityOptions {
  mapInstance: maplibregl.Map | null;
  interactive: boolean;
  allowRotation: boolean;
}

/**
 * Enables or disables all map interaction handlers based on the `interactive`
 * and `allowRotation` props.  Runs whenever those props or the map instance
 * change so the handlers are always in sync with the current prop values.
 */
export function useMapInteractivity({
  mapInstance,
  interactive,
  allowRotation,
}: UseMapInteractivityOptions): void {
  useEffect(() => {
    const map = mapInstance;
    if (!map) return;

    if (interactive) {
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();
      map.keyboard.enable();
      if (allowRotation) {
        map.dragRotate.enable();
        map.touchZoomRotate.enableRotation();
      } else {
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
      }
    } else {
      map.scrollZoom.disable();
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
      map.touchZoomRotate.disableRotation();
      map.dragRotate.disable();
    }
  }, [interactive, allowRotation, mapInstance]);
}
