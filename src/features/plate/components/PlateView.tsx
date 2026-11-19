import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PlateGeometry } from "../geometry";
import type { PlateExtras } from "../extras";
import { PlateScene, type PlateLook } from "../PlateScene";
import { useI18n } from "@/context/i18n/context";

export interface PlateViewHandle {
  snapshot: (size: number) => HTMLCanvasElement | null;
  /** The plate with standard materials, for the photo render and GLB export. */
  exportScene: (textureSize?: number) => ReturnType<PlateScene["exportScene"]> | null;
}

interface PlateViewProps {
  geometry: PlateGeometry | null;
  look: PlateLook;
  drape: HTMLCanvasElement | null;
  /** Route, markers and measuring line drawn on the surface. */
  overlay?: HTMLCanvasElement | null;
  /** Lakes and rivers over the plate's square. */
  waterMask?: HTMLCanvasElement | null;
  /** While set, a tap on the plate reports the point under it (plate texture coordinates). */
  onPick?: ((uv: [number, number]) => void) | null;
  extras: PlateExtras | null;
  /** Text on the summit pin's tag. */
  peakText: string;
  label: string;
  onInteract?: () => void;
}

/** The interactive 3D plate. Owns the WebGL scene for as long as it is mounted. */
const PlateView = forwardRef<PlateViewHandle, PlateViewProps>(function PlateView(
  {
    geometry,
    look,
    drape,
    overlay = null,
    waterMask = null,
    onPick,
    extras,
    peakText,
    label,
    onInteract,
  },
  ref,
) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<PlateScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let created: PlateScene;
    try {
      created = new PlateScene(canvasRef.current!);
    } catch {
      // No WebGL (old phone, or blocked by the browser).
      queueMicrotask(() => setFailed(true));
      return;
    }
    queueMicrotask(() => setScene(created));
    return () => created.dispose();
  }, []);

  useEffect(() => {
    if (scene) scene.onInteract = onInteract;
  }, [scene, onInteract]);

  useEffect(() => {
    if (scene && geometry) scene.setGeometry(geometry);
  }, [scene, geometry]);

  useEffect(() => {
    scene?.setLook(look);
  }, [scene, look]);

  useEffect(() => {
    scene?.setDrape(drape);
  }, [scene, drape]);

  useEffect(() => {
    scene?.setExtras(extras, peakText);
  }, [scene, extras, peakText]);

  useEffect(() => {
    scene?.setOverlay(overlay);
  }, [scene, overlay]);

  useEffect(() => {
    scene?.setWaterMask(waterMask);
  }, [scene, waterMask]);

  // A tap (not a drag) picks a point when picking is on.
  const downAt = useRef<[number, number] | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      snapshot: (size) => scene?.snapshot(size) ?? null,
      exportScene: (textureSize) => scene?.exportScene(textureSize) ?? null,
    }),
    [scene],
  );

  return (
    <>
      <canvas
        ref={canvasRef}
        className="plate-canvas"
        role="img"
        aria-label={`${label} ${t("plate.a11y.keys")}`}
        // Arrow keys turn and tilt the plate, + and − zoom.
        tabIndex={0}
        data-picking={onPick ? "true" : undefined}
        onPointerDown={(event) => {
          downAt.current = [event.clientX, event.clientY];
        }}
        onPointerUp={(event) => {
          const start = downAt.current;
          downAt.current = null;
          if (!onPick || !scene || !start) return;
          if (Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) return;
          const uv = scene.pick(event.clientX, event.clientY);
          if (uv) onPick(uv);
        }}
        onKeyDown={(event) => {
          const moves: Record<string, [number, number, number]> = {
            ArrowLeft: [-12, 0, 1],
            ArrowRight: [12, 0, 1],
            ArrowUp: [0, -6, 1],
            ArrowDown: [0, 6, 1],
            "+": [0, 0, 0.88],
            "=": [0, 0, 0.88],
            "-": [0, 0, 1.14],
          };
          const move = moves[event.key];
          if (!move || !scene) return;
          event.preventDefault();
          scene.nudge(...move);
        }}
        data-ready={scene && geometry ? "true" : "false"}
      />
      {failed && (
        <p className="plate-stage__message" role="alert">
          {t("plate.noWebgl")}
        </p>
      )}
    </>
  );
});

export default PlateView;
