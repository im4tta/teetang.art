import { useEffect, useRef, useState, type CSSProperties } from "react";
import maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapInstanceRef } from "@/services/map/types";
import { MAP_CENTER_SYNC_EPSILON, MAP_ZOOM_SYNC_EPSILON } from "@/services/map";
import { useRadiusLayer } from "@/hooks/useRadiusLayer";
import { useMapInteractivity } from "@/hooks/useMapInteractivity";
import { applyIncrementalStyleUpdate } from "@/services/map/styleUtils";

interface MapPreviewProps {
  style: StyleSpecification;
  center: [lon: number, lat: number];
  zoom: number;
  mapRef: MapInstanceRef;
  interactive?: boolean;
  allowRotation?: boolean;
  minZoom?: number;
  maxZoom?: number;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  onMove?: (center: [number, number], zoom: number) => void;
  containerStyle?: CSSProperties;
  overzoomScale?: number;
  radiusMeters?: number;
  radiusStyle?: string;
  radiusLabel?: string;
}

/**
 * MapLibre preview wrapper.
 *
 * - Keeps `preserveDrawingBuffer` enabled for export snapshots.
 * - Syncs controlled style/center/zoom from form state.
 * - Exposes full map instance via a shared ref for export/controls.
 */
export default function MapPreview({
  style,
  center,
  zoom,
  mapRef,
  interactive = false,
  allowRotation = false,
  minZoom,
  maxZoom,
  onMoveEnd,
  onMove,
  containerStyle,
  overzoomScale = 1,
  radiusMeters = 0,
  radiusStyle = "dashed",
  radiusLabel = "",
}: MapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isSyncing = useRef(false);
  const hasMountedStyleRef = useRef(false);
  const prevStyleRef = useRef<StyleSpecification | null>(null);
  const onMoveEndRef = useRef(onMoveEnd);
  const onMoveRef = useRef(onMove);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  useEffect(() => {
    onMoveEndRef.current = onMoveEnd;
    onMoveRef.current = onMove;
  }, [onMoveEnd, onMove]);

  // ── Mount: create map instance ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center,
      zoom,
      interactive: false,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    mapRef.current = map;
    setMapInstance(map);

    // Force resize on next animation frame to ensure correct dimensions
    // in PWA standalone mode where initial container size may be stale.
    requestAnimationFrame(() => {
      mapRef.current?.resize();
    });

    map.on("moveend", () => {
      if (isSyncing.current) return;
      const c = map.getCenter();
      onMoveEndRef.current?.([c.lng, c.lat], map.getZoom());
    });
    map.on("move", () => {
      if (isSyncing.current) return;
      const c = map.getCenter();
      onMoveRef.current?.([c.lng, c.lat], map.getZoom());
    });

    // Tell MapLibre to re-measure its canvas whenever the container resizes.
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      mapRef.current = null;
      map.remove();
    };
    // Mount once; follow-up updates are handled by effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Interactivity ────────────────────────────────────────────────────────
  useMapInteractivity({ mapInstance, interactive, allowRotation });

  // ── Zoom bounds ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (typeof minZoom === "number") map.setMinZoom(minZoom);
    if (typeof maxZoom === "number") map.setMaxZoom(maxZoom);
  }, [minZoom, maxZoom, mapRef]);

  // ── Style sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Initial style is already provided in map constructor — record it and skip.
    if (!hasMountedStyleRef.current) {
      hasMountedStyleRef.current = true;
      prevStyleRef.current = style;
      return;
    }

    if (!map.isStyleLoaded()) {
      const applyWhenReady = () => {
        map.setStyle(style);
        prevStyleRef.current = style;
      };
      map.once("load", applyWhenReady);
      return () => {
        map.off("load", applyWhenReady);
      };
    }

    if (
      prevStyleRef.current &&
      JSON.stringify(prevStyleRef.current.sources) === JSON.stringify(style.sources)
    ) {
      applyIncrementalStyleUpdate(map, prevStyleRef.current, style);
    } else {
      map.setStyle(style);
    }

    prevStyleRef.current = style;
  }, [style, mapRef]);

  // ── Center / zoom sync ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const centerDelta = Math.max(
      Math.abs(currentCenter.lng - center[0]),
      Math.abs(currentCenter.lat - center[1]),
    );
    const zoomDelta = Math.abs(map.getZoom() - zoom);

    if (centerDelta < MAP_CENTER_SYNC_EPSILON && zoomDelta < MAP_ZOOM_SYNC_EPSILON) return;

    isSyncing.current = true;
    map.jumpTo({ center, zoom });
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, [center, zoom, mapRef]);

  // ── Radius layer ─────────────────────────────────────────────────────────
  useRadiusLayer({ mapRef, radiusMeters, radiusStyle, radiusLabel, center });

  const normalizedOverzoomScale = Math.max(1, overzoomScale);
  const innerStyle: CSSProperties =
    normalizedOverzoomScale === 1
      ? { width: "100%", height: "100%" }
      : {
          width: `${normalizedOverzoomScale * 100}%`,
          height: `${normalizedOverzoomScale * 100}%`,
          transform: `scale(${1 / normalizedOverzoomScale})`,
          transformOrigin: "top left",
        };

  return (
    <div className="map-container" style={{ ...containerStyle, overflow: "hidden" }}>
      <div ref={containerRef} style={innerStyle} />
    </div>
  );
}
