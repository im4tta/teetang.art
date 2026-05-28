import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { MarkerIconDefinition, MarkerItem } from "@/features/markers/domain/types";
import type { MapInstanceRef } from "@/features/map/domain/types";
import { findMarkerIcon } from "@/features/markers/infrastructure/iconRegistry";
import MarkerVisual from "./MarkerVisual";
import { MAX_MARKER_SIZE, MIN_MARKER_SIZE } from "@/features/markers/domain/constants";
import { clamp } from "@/shared/geo/math";

const KEYBOARD_MOVE_STEP = 1;
const KEYBOARD_RESIZE_STEP = 3;

const ARROW_DELTAS: Partial<Record<string, [number, number]>> = {
  ArrowUp: [0, -KEYBOARD_MOVE_STEP],
  ArrowDown: [0, KEYBOARD_MOVE_STEP],
  ArrowLeft: [-KEYBOARD_MOVE_STEP, 0],
  ArrowRight: [KEYBOARD_MOVE_STEP, 0],
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const { tagName } = target;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

function isMobileTouchInput(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

function getTouchDistance(touches: {
  length: number;
  [index: number]: { clientX: number; clientY: number };
}): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

interface MarkerOverlayProps {
  markers: MarkerItem[];
  customIcons: MarkerIconDefinition[];
  mapRef: MapInstanceRef;
  isMarkerEditMode?: boolean;
  activeMarkerId?: string | null;
  onActiveMarkerChange?: (markerId: string | null) => void;
  onMarkerPositionChange?: (markerId: string, lat: number, lon: number) => void;
  onMarkerSizeChange?: (markerId: string, size: number) => void;
  overzoomScale: number;
}

function getOppositeHighlightColor(input: string): string {
  const hexMatch = input.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!hexMatch) {
    return "#ffd84d";
  }

  const hex = hexMatch[1];
  const r = 255 - Number.parseInt(hex.slice(0, 2), 16);
  const g = 255 - Number.parseInt(hex.slice(2, 4), 16);
  const b = 255 - Number.parseInt(hex.slice(4, 6), 16);

  const toHex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function MarkerOverlay({
  markers,
  customIcons,
  mapRef,
  isMarkerEditMode = false,
  activeMarkerId = null,
  onActiveMarkerChange,
  onMarkerPositionChange,
  onMarkerSizeChange,
  overzoomScale,
}: MarkerOverlayProps) {
  const [renderTick, setRenderTick] = useState(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [isTouchSelectionActive, setIsTouchSelectionActive] = useState(false);
  const [touchResizeState, setTouchResizeState] = useState<{
    markerId: string;
    startDistance: number;
    startSize: number;
  } | null>(null);

  const map = mapRef.current;
  const projectedMarkers = useMemo(
    () =>
      map
        ? markers.flatMap((marker) => {
            const icon = findMarkerIcon(marker.iconId, customIcons);
            if (!icon) {
              return [];
            }
            try {
              const point = map.project([marker.lon, marker.lat]);
              return [
                {
                  marker,
                  icon,
                  x: point.x / overzoomScale,
                  y: point.y / overzoomScale,
                },
              ];
            } catch {
              return [];
            }
          })
        : [],
    // renderTick drives recomputation when the map view changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, markers, customIcons, renderTick],
  );

  const updateMarkerByClientPoint = useCallback(
    (markerId: string, clientX: number, clientY: number) => {
      if (!isMarkerEditMode || !onMarkerPositionChange) {
        return;
      }

      const mapInst = mapRef.current;
      const overlay = overlayRef.current;
      if (!mapInst || !overlay) {
        return;
      }

      const bounds = overlay.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }

      const x = Math.max(0, Math.min(bounds.width, clientX - bounds.left));
      const y = Math.max(0, Math.min(bounds.height, clientY - bounds.top));

      try {
        const mapPointX = x * overzoomScale;
        const mapPointY = y * overzoomScale;
        const position = mapInst.unproject([mapPointX, mapPointY]);
        onMarkerPositionChange(markerId, position.lat, position.lng);
      } catch {
        // Ignore projection failures during drag.
      }
    },
    [isMarkerEditMode, mapRef, onMarkerPositionChange],
  );

  const nudgeMarkerByScreenDelta = useCallback(
    (marker: MarkerItem, deltaX: number, deltaY: number) => {
      if (!isMarkerEditMode || !onMarkerPositionChange) {
        return;
      }

      const mapInst = mapRef.current;
      const overlay = overlayRef.current;
      if (!mapInst || !overlay) {
        return;
      }

      const bounds = overlay.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }

      try {
        const currentPoint = mapInst.project([marker.lon, marker.lat]);
        const overlayX = clamp(currentPoint.x / overzoomScale + deltaX, 0, bounds.width);
        const overlayY = clamp(currentPoint.y / overzoomScale + deltaY, 0, bounds.height);
        const nextPosition = mapInst.unproject([
          overlayX * overzoomScale,
          overlayY * overzoomScale,
        ]);
        onMarkerPositionChange(marker.id, nextPosition.lat, nextPosition.lng);
      } catch {
        // Ignore projection failures during keyboard nudging.
      }
    },
    [isMarkerEditMode, mapRef, onMarkerPositionChange],
  );

  const handleMarkerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const markerId = event.currentTarget.dataset.id;
      if (!markerId || !isMarkerEditMode || !onMarkerPositionChange) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.pointerType === "touch") {
        if (isMobileTouchInput()) {
          onActiveMarkerChange?.(markerId);
          setIsTouchSelectionActive(false);
          setDraggingMarkerId(markerId);
          updateMarkerByClientPoint(markerId, event.clientX, event.clientY);
          return;
        }
        onActiveMarkerChange?.(markerId);
        setIsTouchSelectionActive(true);
        return;
      }

      onActiveMarkerChange?.(markerId);
      setIsTouchSelectionActive(false);
      setDraggingMarkerId(markerId);
      updateMarkerByClientPoint(markerId, event.clientX, event.clientY);
    },
    [isMarkerEditMode, onActiveMarkerChange, onMarkerPositionChange, updateMarkerByClientPoint],
  );

  const handleMarkerTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const markerId = event.currentTarget.dataset.id;
      const marker = markers.find((item) => item.id === markerId);
      if (!markerId || !marker || !isMarkerEditMode) {
        return;
      }

      // Mobile fallback: some browsers don't reliably fire pointer events.
      // Start drag on single-touch.
      if (isMobileTouchInput() && event.touches.length === 1 && onMarkerPositionChange) {
        event.preventDefault();
        event.stopPropagation();
        onActiveMarkerChange?.(markerId);
        setIsTouchSelectionActive(false);
        setDraggingMarkerId(markerId);
        const touch = event.touches[0];
        updateMarkerByClientPoint(markerId, touch.clientX, touch.clientY);
        return;
      }

      // Desktop/tablet: two-finger pinch resizes the active marker
      if (
        !onMarkerSizeChange ||
        event.touches.length < 2 ||
        !isTouchSelectionActive ||
        activeMarkerId !== markerId
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setTouchResizeState({
        markerId: marker.id,
        startDistance: getTouchDistance(event.touches),
        startSize: marker.size,
      });
    },
    [
      activeMarkerId,
      isMarkerEditMode,
      isTouchSelectionActive,
      markers,
      onActiveMarkerChange,
      onMarkerPositionChange,
      onMarkerSizeChange,
      updateMarkerByClientPoint,
    ],
  );

  useEffect(() => {
    if (!touchResizeState || !onMarkerSizeChange || isMobileTouchInput()) {
      return;
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        return;
      }
      event.preventDefault();
      if (touchResizeState.startDistance <= 0) {
        return;
      }
      const nextDistance = getTouchDistance(event.touches as TouchList);
      const nextSize = clamp(
        touchResizeState.startSize * (nextDistance / touchResizeState.startDistance),
        MIN_MARKER_SIZE,
        MAX_MARKER_SIZE,
      );
      onMarkerSizeChange(touchResizeState.markerId, nextSize);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        setTouchResizeState(null);
      }
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [onMarkerSizeChange, touchResizeState]);

  const handleMarkerTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) {
      setTouchResizeState(null);
      setIsTouchSelectionActive(false);
    }
  }, []);

  // Handles wheel on the overlay (including bubbled events from individual markers).
  // stopPropagation prevents the underlying map from zooming.
  const handleOverlayWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isMarkerEditMode || !onMarkerSizeChange || !activeMarkerId) {
        return;
      }
      const marker = markers.find((item) => item.id === activeMarkerId);
      if (!marker) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const direction = event.deltaY > 0 ? -1 : 1;
      const nextSize = clamp(marker.size + direction, MIN_MARKER_SIZE, MAX_MARKER_SIZE);
      onMarkerSizeChange(marker.id, nextSize);
    },
    [activeMarkerId, isMarkerEditMode, markers, onMarkerSizeChange],
  );

  useEffect(() => {
    if (!draggingMarkerId || !isMarkerEditMode) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateMarkerByClientPoint(draggingMarkerId, event.clientX, event.clientY);
    };

    const stopDrag = () => {
      setDraggingMarkerId(null);
      setTouchResizeState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [draggingMarkerId, isMarkerEditMode, updateMarkerByClientPoint]);

  useEffect(() => {
    if (!draggingMarkerId || !isMarkerEditMode || !isMobileTouchInput()) {
      return;
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }
      event.preventDefault();
      const touch = event.touches[0];
      updateMarkerByClientPoint(draggingMarkerId, touch.clientX, touch.clientY);
    };

    const stopDrag = () => {
      setDraggingMarkerId(null);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", stopDrag);
    window.addEventListener("touchcancel", stopDrag);

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopDrag);
      window.removeEventListener("touchcancel", stopDrag);
    };
  }, [draggingMarkerId, isMarkerEditMode, updateMarkerByClientPoint]);

  useEffect(() => {
    if (isMarkerEditMode) {
      return;
    }
    setDraggingMarkerId(null);
    onActiveMarkerChange?.(null);
    setTouchResizeState(null);
    setIsTouchSelectionActive(false);
  }, [isMarkerEditMode, onActiveMarkerChange]);

  useEffect(() => {
    if (!isMarkerEditMode || !isTouchSelectionActive || !activeMarkerId) {
      return;
    }

    const { overflow, touchAction } = document.body.style;
    const { overflow: htmlOverflow, touchAction: htmlTouchAction } = document.documentElement.style;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.touchAction = "none";

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.touchAction = touchAction;
      document.documentElement.style.overflow = htmlOverflow;
      document.documentElement.style.touchAction = htmlTouchAction;
    };
  }, [activeMarkerId, isMarkerEditMode, isTouchSelectionActive]);

  useEffect(() => {
    if (!isMarkerEditMode || !activeMarkerId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const marker = markers.find((item) => item.id === activeMarkerId);
      if (!marker) {
        return;
      }

      const arrowDelta = ARROW_DELTAS[event.key];
      if (arrowDelta) {
        event.preventDefault();
        nudgeMarkerByScreenDelta(marker, arrowDelta[0], arrowDelta[1]);
        return;
      }

      if (!onMarkerSizeChange) {
        return;
      }

      const isPlus = event.key === "+" || event.key === "=";
      const isMinus = event.key === "-" || event.key === "_";
      if (!isPlus && !isMinus) {
        return;
      }
      event.preventDefault();
      const isDesktopInput = !window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      const step = isDesktopInput ? KEYBOARD_RESIZE_STEP : 1;
      const delta = isPlus ? step : -step;
      const nextSize = clamp(marker.size + delta, MIN_MARKER_SIZE, MAX_MARKER_SIZE);
      onMarkerSizeChange(marker.id, nextSize);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeMarkerId, isMarkerEditMode, markers, nudgeMarkerByScreenDelta, onMarkerSizeChange]);

  useEffect(() => {
    const mapInst = mapRef.current;
    if (!mapInst) {
      return;
    }

    const sync = () => {
      setRenderTick((value) => value + 1);
    };

    mapInst.on("move", sync);
    mapInst.on("moveend", sync);
    mapInst.on("rotate", sync);
    mapInst.on("resize", sync);
    mapInst.on("load", sync);

    return () => {
      mapInst.off("move", sync);
      mapInst.off("moveend", sync);
      mapInst.off("rotate", sync);
      mapInst.off("resize", sync);
      mapInst.off("load", sync);
    };
  }, [mapRef]);

  if (projectedMarkers.length === 0) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`poster-marker-overlay${isMarkerEditMode ? " is-edit-mode" : ""}`}
      onPointerDown={handleMarkerPointerDown}
      onWheel={handleOverlayWheel}
    >
      {projectedMarkers.map(({ marker, icon, x, y }) => {
        const isDragging = draggingMarkerId === marker.id;
        const isActive = activeMarkerId === marker.id;
        const isResizing = touchResizeState?.markerId === marker.id;

        return (
          <div
            key={marker.id}
            data-id={marker.id}
            className={`poster-marker${isMarkerEditMode ? " is-draggable" : ""}${
              isDragging ? " is-dragging" : ""
            }${isActive ? " is-selected" : ""}${isResizing ? " is-resizing" : ""}`}
            style={
              {
                left: `${x}px`,
                top: `${y}px`,
                "--marker-size": `${marker.size}px`,
                "--marker-color": marker.color,
                "--marker-highlight-color": getOppositeHighlightColor(marker.color),
                zIndex: isDragging ? 10 : isActive ? 5 : 1,
              } as CSSProperties
            }
            onPointerDown={handleMarkerPointerDown}
            onTouchStart={handleMarkerTouchStart}
            onTouchEnd={handleMarkerTouchEnd}
            onTouchCancel={handleMarkerTouchEnd}
          >
            <MarkerVisual icon={icon} size={marker.size} color={marker.color} />
            {marker.label ? <span className="poster-marker-label">{marker.label}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
