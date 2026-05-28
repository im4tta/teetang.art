import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { MapInstanceRef } from "@/features/map/domain/types";
import type { Route } from "@/features/routes/domain/types";
import type { MarkerIconDefinition } from "@/features/markers/domain/types";
import type { Coordinate } from "@/shared/geo/types";
import { findMarkerIcon } from "@/features/markers/infrastructure/iconRegistry";
import MarkerVisual from "@/features/markers/ui/MarkerVisual";
import { routeEndpoints } from "@/features/routes/infrastructure/helpers";

interface RouteEndpointsOverlayProps {
  routes: Route[];
  customIcons: MarkerIconDefinition[];
  mapRef: MapInstanceRef;
  visible: boolean;
  overzoomScale: number;
  draggable?: boolean;
  onEndpointDragEnd?: (routeId: string, type: "start" | "finish", lat: number, lon: number) => void;
  onViaPointDragEnd?: (routeId: string, index: number, lat: number, lon: number) => void;
  onViaPointDelete?: (routeId: string, index: number) => void;
}

interface ProjectedItem {
  key: string;
  routeId: string;
  type: "start" | "finish" | "via";
  viaIndex?: number;
  x: number;
  y: number;
  icon: MarkerIconDefinition;
  color: string;
  size: number;
  lat: number;
  lon: number;
}

export default function RouteEndpointsOverlay({
  routes,
  customIcons,
  mapRef,
  visible,
  overzoomScale,
  draggable,
  onEndpointDragEnd,
  onViaPointDragEnd,
  onViaPointDelete,
}: RouteEndpointsOverlayProps) {
  const [renderTick, setRenderTick] = useState(0);
  const dragRef = useRef<{
    key: string;
    startX: number;
    startY: number;
    item: ProjectedItem;
  } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => setRenderTick((v) => v + 1);
    map.on("move", sync);
    map.on("moveend", sync);
    map.on("rotate", sync);
    map.on("resize", sync);
    map.on("load", sync);
    return () => {
      map.off("move", sync);
      map.off("moveend", sync);
      map.off("rotate", sync);
      map.off("resize", sync);
      map.off("load", sync);
    };
  }, [mapRef]);

  const map = mapRef.current;
  const projected = useMemo(() => {
    if (!map || !visible) return [];
    const items: ProjectedItem[] = [];
    const projectPoint = (lat: number, lon: number) => {
      try {
        const p = map.project([lon, lat]);
        return { x: p.x / overzoomScale, y: p.y / overzoomScale };
      } catch {
        return null;
      }
    };
    for (const route of routes) {
      if (!route.showEndpoints) continue;
      const endpoints = routeEndpoints(route);
      if (!endpoints) continue;
      const startIcon = findMarkerIcon(route.startMarker.iconId, customIcons);
      if (startIcon) {
        const p = projectPoint(endpoints.start.lat, endpoints.start.lon);
        if (p)
          items.push({
            key: `${route.id}-start`,
            routeId: route.id,
            type: "start",
            x: p.x,
            y: p.y,
            icon: startIcon,
            color: route.startMarker.color,
            size: route.startMarker.size,
            lat: endpoints.start.lat,
            lon: endpoints.start.lon,
          });
      }
      const finishIcon = findMarkerIcon(route.finishMarker.iconId, customIcons);
      if (finishIcon) {
        const p = projectPoint(endpoints.finish.lat, endpoints.finish.lon);
        if (p)
          items.push({
            key: `${route.id}-finish`,
            routeId: route.id,
            type: "finish",
            x: p.x,
            y: p.y,
            icon: finishIcon,
            color: route.finishMarker.color,
            size: route.finishMarker.size,
            lat: endpoints.finish.lat,
            lon: endpoints.finish.lon,
          });
      }
      for (let i = 0; i < route.waypoints.length; i++) {
        const wp = route.waypoints[i];
        if (!wp) continue;
        const p = projectPoint(wp.lat, wp.lon);
        if (p)
          items.push({
            key: `${route.id}-via-${i}`,
            routeId: route.id,
            type: "via",
            viaIndex: i,
            x: p.x,
            y: p.y,
            icon: { id: "waypoint", label: "", source: "predefined", kind: "svg" },
            color: "#ffffff",
            size: 16,
            lat: wp.lat,
            lon: wp.lon,
          });
      }
    }
    return items;
  }, [map, routes, customIcons, visible, overzoomScale, renderTick]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, item: ProjectedItem) => {
      if (!draggable) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { key: item.key, startX: e.clientX, startY: e.clientY, item };
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
    },
    [draggable],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.zIndex = "9999";
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.releasePointerCapture(e.pointerId);
      el.style.transform = "";
      el.style.zIndex = "";

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const moved = Math.abs(dx) > 2 || Math.abs(dy) > 2;
      if (!moved) {
        dragRef.current = null;
        return;
      }

      const map = mapRef.current;
      if (!map) {
        dragRef.current = null;
        return;
      }

      const newX = drag.item.x + dx;
      const newY = drag.item.y + dy;
      const geo = map.unproject([newX * overzoomScale, newY * overzoomScale]);
      const lat = geo.lat;
      const lon = geo.lng;

      if (drag.item.type === "via" && drag.item.viaIndex !== undefined && onViaPointDragEnd) {
        onViaPointDragEnd(drag.item.routeId, drag.item.viaIndex, lat, lon);
      } else if (onEndpointDragEnd) {
        onEndpointDragEnd(drag.item.routeId, drag.item.type as "start" | "finish", lat, lon);
      }
      dragRef.current = null;
    },
    [mapRef, overzoomScale, onEndpointDragEnd, onViaPointDragEnd],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, item: ProjectedItem) => {
      if (item.type === "via" && item.viaIndex !== undefined && onViaPointDelete) {
        e.preventDefault();
        e.stopPropagation();
        onViaPointDelete(item.routeId, item.viaIndex);
      }
    },
    [onViaPointDelete],
  );

  if (!visible || projected.length === 0) return null;

  return (
    <div className="poster-route-endpoints" aria-hidden="true">
      {projected.map((item) => {
        const isVia = item.type === "via";
        const style: CSSProperties = {
          left: `${item.x}px`,
          top: `${item.y}px`,
          touchAction: draggable ? "none" : undefined,
          cursor: draggable ? "grab" : undefined,
        };
        if (isVia) {
          style.width = `${item.size}px`;
          style.height = `${item.size}px`;
          style.borderRadius = "50%";
          style.background = "rgba(255,255,255,0.9)";
          style.border = "2px solid #64748b";
          style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
          style.display = "flex";
          style.alignItems = "center";
          style.justifyContent = "center";
          style.fontSize = "10px";
          style.color = "#333";
          style.fontWeight = "bold";
        }
        return (
          <div
            key={item.key}
            className="poster-route-endpoint"
            style={style}
            onPointerDown={draggable ? (e) => handlePointerDown(e, item) : undefined}
            onPointerMove={draggable ? handlePointerMove : undefined}
            onPointerUp={draggable ? handlePointerUp : undefined}
            onDoubleClick={draggable ? (e) => handleDoubleClick(e, item) : undefined}
          >
            {isVia ? (
              <span style={{ fontSize: 10, lineHeight: "16px" }}>×</span>
            ) : (
              <MarkerVisual icon={item.icon} size={item.size} color={item.color} />
            )}
          </div>
        );
      })}
    </div>
  );
}
