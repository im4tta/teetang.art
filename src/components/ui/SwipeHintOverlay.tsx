import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import type { SwipeHandlers } from "@/hooks/useSwipeGestures";

interface Props {
  isMobileViewport: boolean;
  isEditing: boolean;
  isMarkerEditorActive: boolean;
  routeDrawMode: boolean;
  swipeHandlers: SwipeHandlers;
}

type ArrowConfig = {
  pos: "top" | "bottom" | "left" | "right";
  Icon: typeof ArrowUp;
  label: string;
  dir?: "column" | "column-reverse";
  axis: "vertical" | "horizontal";
};

const ARROW_CONFIGS: ArrowConfig[] = [
  { pos: "top",    Icon: ArrowUp,    label: "ផ្លាស់ប្តូររាង", dir: "column",         axis: "vertical" },
  { pos: "bottom", Icon: ArrowDown,  label: "ផ្លាស់ប្តូររាង", dir: "column-reverse", axis: "vertical" },
  { pos: "left",   Icon: ArrowLeft,  label: "ស្ទីល",           axis: "horizontal" },
  { pos: "right",  Icon: ArrowRight, label: "ស្ទីល",           axis: "horizontal" },
];

export default function SwipeHintOverlay({ isMobileViewport, isEditing, isMarkerEditorActive, routeDrawMode, swipeHandlers }: Props) {
  if (isEditing || isMarkerEditorActive || routeDrawMode) return null;

  return (
    <div
      className="swipe-overlay"
      onTouchStart={swipeHandlers.onTouchStart}
      onTouchEnd={swipeHandlers.onTouchEnd}
      onMouseDown={swipeHandlers.onMouseDown}
      onMouseUp={swipeHandlers.onMouseUp}
      aria-hidden="true"
    >
      {isMobileViewport && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
          {ARROW_CONFIGS.map(({ pos, Icon, label, dir, axis }) => {
            const posStyle = axis === "vertical"
              ? { [pos]: 8, left: "50%", transform: "translateX(-50%)", flexDirection: dir as any }
              : { [pos]: 8, top: "50%", transform: "translateY(-50%)", flexDirection: "column" as const };
            return (
              <div
                key={pos}
                style={{ position: "absolute", ...posStyle, display: "flex", alignItems: "center", gap: 2, opacity: 0.6 }}
              >
                <Icon size={16} style={{ color: "#fff" }} />
                <span style={{ fontSize: 10, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
