import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PlateGeometry } from "../geometry";
import { PlateScene, type PlateLook } from "../PlateScene";
import { useI18n } from "@/context/i18n/context";

export interface PlateViewHandle {
  snapshot: (size: number) => HTMLCanvasElement | null;
}

interface PlateViewProps {
  geometry: PlateGeometry | null;
  look: PlateLook;
  drape: HTMLCanvasElement | null;
  label: string;
  onInteract?: () => void;
}

/** The interactive 3D plate. Owns the WebGL scene for as long as it is mounted. */
const PlateView = forwardRef<PlateViewHandle, PlateViewProps>(function PlateView(
  { geometry, look, drape, label, onInteract },
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

  useImperativeHandle(ref, () => ({ snapshot: (size) => scene?.snapshot(size) ?? null }), [scene]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="plate-canvas"
        role="img"
        aria-label={label}
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
