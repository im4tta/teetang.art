import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Route } from "@/services/routes/types";
import { fetchOsrmRoute } from "@/api/osrm";
import type { MapInstanceRef } from "@/services/map/types";
import type { PosterAction } from "@/context/posterReducer";

interface UseRouteInteractionsOptions {
  mapRef: MapInstanceRef;
  routes: Route[];
  snapToRoads: boolean;
  routeDrawMode: boolean;
  routesLength: number; // used as dep for map click effect
  dispatch: React.Dispatch<PosterAction>;
}

export function useRouteInteractions({
  mapRef,
  routes,
  snapToRoads,
  routeDrawMode,
  routesLength,
  dispatch,
}: UseRouteInteractionsOptions) {
  const routeDrawStartRef = useRef<{ lat: number; lon: number } | null>(null);
  const routeDrawOverlayRef = useRef<HTMLDivElement | null>(null);

  // ── Route draw mode map-click handler ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeDrawMode) return;
    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      if (!routeDrawStartRef.current) {
        routeDrawStartRef.current = { lat, lon: lng };
        const ov = routeDrawOverlayRef.current;
        if (ov) {
          ov.textContent = "Now click the finish point on the map";
          ov.classList.add("route-draw-hint--active");
        }
        return;
      }
      const start = routeDrawStartRef.current;
      const newRouteId = `route-${Date.now()}`;
      const newRoute: Route = {
        id: newRouteId,
        label: `Drawn Route (${routesLength + 1})`,
        color: "#3b82f6",
        opacity: 0.8,
        strokeWidth: 4,
        lineStyle: "solid",
        source: "manual",
        visible: true,
        showEndpoints: true,
        segments: [[{ lat: start.lat, lon: start.lon }, { lat, lon: lng }]],
        waypoints: [],
        startMarker: { iconId: "circle", color: "#22c55e", size: 28 },
        finishMarker: { iconId: "circle", color: "#ef4444", size: 28 },
      };
      dispatch({ type: "ADD_ROUTE", route: newRoute });
      routeDrawStartRef.current = null;
      dispatch({ type: "SET_ROUTE_DRAW_MODE", active: false });
      if (snapToRoads) {
        fetchOsrmRoute([[start.lat, start.lon], [lat, lng]]).then(coords => {
          if (coords?.length > 1)
            dispatch({ type: "UPDATE_ROUTE", routeId: newRouteId, changes: { segments: [coords] } });
        });
      }
    };
    map.on("click", handleMapClick);
    return () => { map.off("click", handleMapClick); routeDrawStartRef.current = null; };
  }, [mapRef, routeDrawMode, routesLength, dispatch, snapToRoads]);

  // Reset overlay text when draw mode exits
  useEffect(() => {
    if (!routeDrawMode) {
      routeDrawStartRef.current = null;
      const ov = routeDrawOverlayRef.current;
      if (ov) {
        ov.textContent = "Click the map to place the start point";
        ov.classList.remove("route-draw-hint--active");
      }
    }
  }, [routeDrawMode]);

  // ── Snap helper ────────────────────────────────────────────────────────
  const snapAndUpdateRoute = useCallback(
    (routeId: string, coords: [number, number][]) => {
      if (!snapToRoads) return;
      fetchOsrmRoute(coords).then(c => {
        if (c?.length > 1)
          dispatch({ type: "UPDATE_ROUTE", routeId, changes: { segments: [c] } });
      });
    },
    [snapToRoads, dispatch],
  );

  // ── Endpoint drag ──────────────────────────────────────────────────────
  const handleRouteEndpointDragEnd = useCallback(
    (routeId: string, type: "start" | "finish", lat: number, lon: number) => {
      const route = routes.find(r => r.id === routeId);
      if (!route) return;
      const segs = route.segments.map(seg => {
        if (!seg.length) return seg;
        return type === "start"
          ? [{ lat, lon }, ...seg.slice(1)]
          : [...seg.slice(0, -1), { lat, lon }];
      });
      dispatch({ type: "UPDATE_ROUTE", routeId, changes: { segments: segs } });
      const pts = segs
        .flatMap(s => [s[0]!, s[s.length - 1]!])
        .filter((p, i, a) => a.findIndex(x => x.lat === p.lat && x.lon === p.lon) === i);
      if (pts.length >= 2)
        snapAndUpdateRoute(routeId, [
          ...pts.map(p => [p.lat, p.lon] as [number, number]),
          ...route.waypoints.map(w => [w.lat, w.lon] as [number, number]),
        ]);
    },
    [routes, dispatch, snapAndUpdateRoute],
  );

  // ── Via point drag ─────────────────────────────────────────────────────
  const handleViaPointDragEnd = useCallback(
    (routeId: string, index: number, lat: number, lon: number) => {
      const route = routes.find(r => r.id === routeId);
      if (!route) return;
      const wps = [...route.waypoints];
      wps[index] = { lat, lon };
      dispatch({ type: "UPDATE_ROUTE", routeId, changes: { waypoints: wps } });
      const first = route.segments[0]![0]!;
      const last = route.segments[route.segments.length - 1]!;
      snapAndUpdateRoute(routeId, [
        [first.lat, first.lon],
        ...wps.map(w => [w.lat, w.lon] as [number, number]),
        [last[last.length - 1]!.lat, last[last.length - 1]!.lon],
      ]);
    },
    [routes, dispatch, snapAndUpdateRoute],
  );

  // ── Via point delete ───────────────────────────────────────────────────
  const handleViaPointDelete = useCallback(
    (routeId: string, index: number) => {
      const route = routes.find(r => r.id === routeId);
      if (!route) return;
      const wps = route.waypoints.filter((_, i) => i !== index);
      dispatch({ type: "UPDATE_ROUTE", routeId, changes: { waypoints: wps } });
      if (snapToRoads && wps.length > 0) {
        const first = route.segments[0]![0]!;
        const last = route.segments[route.segments.length - 1]!;
        snapAndUpdateRoute(routeId, [
          [first.lat, first.lon],
          ...wps.map(w => [w.lat, w.lon] as [number, number]),
          [last[last.length - 1]!.lat, last[last.length - 1]!.lon],
        ]);
      }
    },
    [routes, dispatch, snapAndUpdateRoute, snapToRoads],
  );

  // ── Route click (add waypoint) ─────────────────────────────────────────
  const handleRouteClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      const map = mapRef.current;
      if (!map || !routes.length) return;
      const pt = e.point;
      for (const route of routes) {
        const seg = route.segments[0];
        if (!seg || seg.length < 2) continue;
        for (let i = 0; i < seg.length - 1; i++) {
          const a = map.project([seg[i]!.lon, seg[i]!.lat]);
          const b = map.project([seg[i + 1]!.lon, seg[i + 1]!.lat]);
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(
            0,
            Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy)),
          );
          const dist = Math.sqrt(
            (pt.x - (a.x + t * dx)) ** 2 + (pt.y - (a.y + t * dy)) ** 2,
          );
          if (dist < 15) {
            const wps = [...(route.waypoints || []), { lat: e.lngLat.lat, lon: e.lngLat.lng }];
            dispatch({ type: "UPDATE_ROUTE", routeId: route.id, changes: { waypoints: wps } });
            if (snapToRoads)
              snapAndUpdateRoute(route.id, [
                [seg[0]!.lat, seg[0]!.lon],
                ...wps.map(w => [w.lat, w.lon] as [number, number]),
                [seg[seg.length - 1]!.lat, seg[seg.length - 1]!.lon],
              ]);
            return;
          }
        }
      }
    },
    [routes, snapToRoads, dispatch, mapRef, snapAndUpdateRoute],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || routeDrawMode || !routes.length) return;
    map.on("click", handleRouteClick);
    return () => { map.off("click", handleRouteClick); };
  }, [mapRef, routeDrawMode, routes.length, handleRouteClick]);

  return {
    routeDrawOverlayRef,
    handleRouteEndpointDragEnd,
    handleViaPointDragEnd,
    handleViaPointDelete,
  };
}
