import {
  LockIcon,
  RecenterIcon,
  UnlockIcon,
  RotateIcon,
  RotateLeftIcon,
  RotateRightIcon,
  CompassIcon,
} from "@/shared/ui/Icons";
import { useI18n } from "@/shared/i18n/context";

interface MapPrimaryControlsProps {
  isMapEditing: boolean;
  isMarkerEditorActive: boolean;
  routeDrawMode: boolean;
  recenterHint: string;
  unlockHint: string;
  onRecenter: () => void;
  onStartEditing: () => void;
  onFinishEditing: () => void;
  isRotationEnabled?: boolean;
  onToggleRotation?: () => void;
  onRotateBy?: (deg: number) => void;
  mapBearing?: number;
  onBearingChange?: (bearing: number) => void;
  onCompassReset?: () => void;
}

export default function MapPrimaryControls({
  isMapEditing,
  isMarkerEditorActive,
  routeDrawMode,
  recenterHint,
  unlockHint,
  onRecenter,
  onStartEditing,
  onFinishEditing,
  isRotationEnabled = false,
  onToggleRotation,
  onRotateBy,
  mapBearing = 0,
  onBearingChange,
  onCompassReset,
}: MapPrimaryControlsProps) {
  const { t } = useI18n();

  if (routeDrawMode) {
    return (
      <>
        <div className="map-control-btn map-control-btn--drawing" aria-live="polite">
          <span>Drawing route — click map</span>
        </div>
      </>
    );
  }

  return (
    <>
      {!isMapEditing ? (
        <button type="button" className="map-control-btn" onClick={onRecenter} title={recenterHint}>
          <RecenterIcon />
          <span>{t("map.recenter")}</span>
        </button>
      ) : null}
      {isMapEditing ? (
        <button
          type="button"
          className="map-control-btn map-control-btn--primary map-control-btn--mode"
          onClick={onFinishEditing}
          title={t("map.lockMapEditing")}
        >
          <LockIcon />
          <span>{t("map.lockMap")}</span>
        </button>
      ) : (
        <button
          type="button"
          className="map-control-btn map-control-btn--primary map-control-btn--mode"
          onClick={onStartEditing}
          title={unlockHint}
          disabled={isMarkerEditorActive}
        >
          <UnlockIcon />
          <span>{t("map.editMap")}</span>
        </button>
      )}

      {isMapEditing && (
        <div className="map-control-sub-group map-rotation-bar">
          <button
            type="button"
            className={`map-control-btn${isRotationEnabled ? " is-active" : ""}`}
            onClick={onToggleRotation}
            title={isRotationEnabled ? t("map.disableRotation") : t("map.enableRotation")}
          >
            <RotateIcon />
          </button>
          <button
            type="button"
            className="map-control-btn"
            onClick={onCompassReset}
            title={t("map.resetToNorth")}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `rotate(${-mapBearing}deg)`,
                transition: "transform 0.3s ease",
              }}
            >
              <CompassIcon />
            </span>
          </button>
          {isRotationEnabled && (
            <>
              <button type="button" className="map-control-btn" onClick={() => onRotateBy?.(-45)}>
                <RotateLeftIcon />
              </button>
              <div className="map-rotation-slider-wrap">
                <input
                  type="range"
                  className="map-rotation-slider"
                  min="-180"
                  max="180"
                  step="1"
                  value={mapBearing}
                  onChange={(e) => onBearingChange?.(Number(e.target.value))}
                  onInput={(e) => onBearingChange?.(Number((e.target as HTMLInputElement).value))}
                />
              </div>
              <button type="button" className="map-control-btn" onClick={() => onRotateBy?.(45)}>
                <RotateRightIcon />
              </button>
              <span className="map-rotation-value">{Math.round(mapBearing)}°</span>
            </>
          )}
        </div>
      )}
    </>
  );
}
