import { useEffect, useState } from "react";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import type { ThemeOption } from "@/services/theme/types";
import { tapFeedback } from "@/utils/haptics";
import { shapeIconPath } from "../shapes";
import {
  BOX_LIMITS,
  EXAGGERATION_LIMITS,
  INK_PRESETS,
  PLATE_DENSITIES,
  PLATE_SHAPES,
  type PlateSettings,
} from "../plateSettings";
import PlateSheet from "./PlateSheet";

interface AdjustSheetProps {
  plate: PlateSettings;
  autoExaggeration: number;
  onChange: (patch: Partial<PlateSettings>) => void;
  onClose: () => void;
}

// The height slider is logarithmic: small steps near 1×, big ones near 30×.
const LOG_MIN = Math.log(EXAGGERATION_LIMITS.min);
const LOG_MAX = Math.log(EXAGGERATION_LIMITS.max);
const toSlider = (value: number) => ((Math.log(value) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
const fromSlider = (position: number) => {
  const value = Math.exp(LOG_MIN + (position / 100) * (LOG_MAX - LOG_MIN));
  return value < 3 ? Math.round(value * 10) / 10 : Math.round(value * 2) / 2;
};

export default function AdjustSheet({
  plate,
  autoExaggeration,
  onChange,
  onClose,
}: AdjustSheetProps) {
  const { t } = useI18n();
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const exaggeration = plate.exaggeration || autoExaggeration;

  useEffect(() => {
    if (plate.style !== "map" || themes.length) return;
    let cancelled = false;
    import("@/services/theme/themeRepository").then(({ themeOptions }) => {
      if (!cancelled) setThemes(themeOptions);
    });
    return () => {
      cancelled = true;
    };
  }, [plate.style, themes.length]);

  return (
    <PlateSheet title={t("plate.adj.title")} onClose={onClose} compact>
      <label className="plate-field">
        <span className="plate-field__label">{t("plate.adj.name")}</span>
        <input
          type="text"
          className="plate-input"
          value={plate.name}
          maxLength={80}
          placeholder={t("plate.untitled")}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>

      <div className="plate-field">
        <div className="plate-field__row">
          <label className="plate-field__label" htmlFor="plate-height">
            {t("plate.adj.height")}
          </label>
          <output className="plate-field__value">×{exaggeration}</output>
          <button
            type="button"
            className="plate-chip"
            aria-pressed={plate.exaggeration === 0}
            onClick={() => onChange({ exaggeration: 0 })}
          >
            {t("plate.adj.auto")}
          </button>
        </div>
        <input
          id="plate-height"
          type="range"
          className="plate-range"
          min={0}
          max={100}
          step={0.5}
          value={toSlider(exaggeration)}
          onChange={(event) => onChange({ exaggeration: fromSlider(Number(event.target.value)) })}
        />
      </div>

      <fieldset className="plate-field">
        <legend className="plate-field__label">{t("plate.adj.shape")}</legend>
        <div className="plate-shapes">
          {PLATE_SHAPES.map((shape) => (
            <button
              key={shape}
              type="button"
              className="plate-shape"
              aria-pressed={plate.shape === shape}
              onClick={() => {
                tapFeedback();
                onChange({ shape });
              }}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d={shapeIconPath(shape)} />
              </svg>
              {t(`plate.shape.${shape}` as TranslationKey)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="plate-field">
        <legend className="plate-field__label">{t("plate.adj.lines")}</legend>
        <div className="plate-segmented plate-segmented--wide">
          {PLATE_DENSITIES.map((density) => (
            <button
              key={density}
              type="button"
              aria-pressed={plate.density === density}
              onClick={() => onChange({ density })}
            >
              {t(`plate.lines.${density}` as TranslationKey)}
            </button>
          ))}
        </div>
      </fieldset>

      {plate.style === "map" && (
        <fieldset className="plate-field">
          <legend className="plate-field__label">{t("plate.adj.mapTheme")}</legend>
          <div className="plate-theme-row">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="plate-theme"
                aria-pressed={plate.theme === theme.id}
                onClick={() => onChange({ theme: theme.id })}
              >
                <span className="plate-theme__swatch" aria-hidden="true">
                  {theme.palette.slice(0, 4).map((color, index) => (
                    <i key={index} style={{ background: color }} />
                  ))}
                </span>
                {theme.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="plate-field">
        <legend className="plate-field__label">{t("plate.adj.colours")}</legend>
        <div className="plate-presets">
          {INK_PRESETS.map(({ id, ink, paper, side }) => (
            <button
              key={id}
              type="button"
              className="plate-preset"
              aria-pressed={plate.ink === ink && plate.paper === paper && plate.side === side}
              onClick={() => onChange({ ink, paper, side })}
            >
              <span className="plate-preset__swatch" style={{ background: paper, color: ink }}>
                <i style={{ background: side }} />
              </span>
              {t(`plate.preset.${id}` as TranslationKey)}
            </button>
          ))}
        </div>
        <div className="plate-colors">
          {(["ink", "paper", "side"] as const).map((key) => (
            <label key={key} className="plate-color">
              <input
                type="color"
                value={plate[key]}
                onChange={(event) => onChange({ [key]: event.target.value })}
              />
              {t(`plate.adj.${key}` as TranslationKey)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="plate-field">
        <div className="plate-field__row">
          <label className="plate-field__label" htmlFor="plate-box">
            {t("plate.adj.box")}
          </label>
          <output className="plate-field__value">{Math.round(plate.box * 100)} mm</output>
        </div>
        <input
          id="plate-box"
          type="range"
          className="plate-range"
          min={BOX_LIMITS.min}
          max={BOX_LIMITS.max}
          step={0.01}
          value={plate.box}
          onChange={(event) => onChange({ box: Number(event.target.value) })}
        />
      </div>

      <label className="plate-switch">
        <input
          type="checkbox"
          checked={plate.shadow}
          onChange={(event) => onChange({ shadow: event.target.checked })}
        />
        <span>{t("plate.adj.shadow")}</span>
      </label>
    </PlateSheet>
  );
}
