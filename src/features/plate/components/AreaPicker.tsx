import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { generateMapStyle } from "@/services/map/maplibreStyle";
import { getTheme } from "@/services/theme/themeRepository";
import { SIZE_LIMITS } from "../plateSettings";

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export interface AreaChange {
  lat: number;
  lon: number;
  sizeKm: number;
}

interface AreaPickerProps {
  lat: number;
  lon: number;
  sizeKm: number;
  onChange: (area: AreaChange) => void;
}

const metresPerPixel = (lat: number, zoom: number) =>
  (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);

const zoomFor = (lat: number, sizeKm: number, squarePx: number) =>
  Math.log2(
    (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180) * squarePx) / (512 * sizeKm * 1000),
  );

/**
 * A map under a fixed square. Dragging moves the plate; pinching or the size
 * slider changes how much ground the square covers.
 */
export default function AreaPicker({ lat, lon, sizeKm, onChange }: AreaPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onChangeRef = useRef(onChange);
  const reportedSizeRef = useRef(sizeKm);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const squarePx = () => squareRef.current?.getBoundingClientRect().width || 240;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: generateMapStyle(getTheme("copper"), { tileProvider: "carto-streets" }),
      center: [lon, lat],
      zoom: zoomFor(lat, sizeKm, squarePx()),
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    const report = () => {
      const center = map.getCenter();
      const size = (squarePx() * metresPerPixel(center.lat, map.getZoom())) / 1000;
      const rounded =
        Math.round(Math.min(SIZE_LIMITS.max, Math.max(SIZE_LIMITS.min, size)) * 10) / 10;
      reportedSizeRef.current = rounded;
      onChangeRef.current({ lat: center.lat, lon: center.lng, sizeKm: rounded });
    };
    map.on("moveend", report);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The size slider zooms the map so the square covers the chosen distance.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || Math.abs(reportedSizeRef.current - sizeKm) < 0.05) return;
    reportedSizeRef.current = sizeKm;
    map.easeTo({ zoom: zoomFor(map.getCenter().lat, sizeKm, squarePx()), duration: 250 });
  }, [sizeKm]);

  // A search result or "Surprise me" moves the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    if (Math.abs(center.lat - lat) < 1e-5 && Math.abs(center.lng - lon) < 1e-5) return;
    map.jumpTo({ center: [lon, lat], zoom: zoomFor(lat, sizeKm, squarePx()) });
    // Only a new place should move the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  return (
    <div className="area-picker">
      <div ref={containerRef} className="area-picker__map" />
      <div ref={squareRef} className="area-picker__square" aria-hidden="true" />
    </div>
  );
}
