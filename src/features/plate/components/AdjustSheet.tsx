import { useEffect, useState } from "react";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import type { ThemeOption } from "@/services/theme/types";
import { tapFeedback } from "@/utils/haptics";
import { shapeIconPath } from "../shapes";
import { BASEMAPS, covers, recentDay, resolveBasemap } from "../basemaps";
import { paletteGradient } from "../palettes";
import {
  BOX_LIMITS,
  EXAGGERATION_LIMITS,
  INK_PRESETS,
  LABEL_FONTS,
  LABEL_RELIEFS,
  PLATE_DENSITIES,
  PLATE_SHAPES,
  RELIEF_PALETTE_IDS,
  type PlateSettings,
} from "../plateSettings";
import PlateSheet from "./PlateSheet";

interface AdjustSheetProps {
  plate: PlateSettings;
  autoExaggeration: number;
  /** Metres from the plate's lowest to its highest point, for the flood slider. */
  relief: number;
  onChange: (patch: Partial<PlateSettings>) => void;
  onClose: () => void;
}

/** Dry and rainy season in mainland Southeast Asia, from last year. */
const SEASONS = [
  { id: "dry", month: "02", day: "15" },
  { id: "rainy", month: "10", day: "10" },
] as const;

/** 6.5 → "06:30". */
const clock = (hour: number) =>
  `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;

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
  relief,
  onChange,
  onClose,
}: AdjustSheetProps) {
  const { t } = useI18n();
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const exaggeration = plate.exaggeration || autoExaggeration;
  const mapKind = plate.style === "satellite" ? "imagery" : plate.style === "topo" ? "topo" : null;
  const activeMap = mapKind ? resolveBasemap(mapKind, plate.basemap, plate.lat, plate.lon) : null;

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
      <label className="plate-field">
        <span className="plate-field__label">{t("plate.adj.nameKm")}</span>
        <input
          type="text"
          className="plate-input"
          lang="km"
          value={plate.nameKm}
          maxLength={80}
          placeholder="ឈ្មោះជាភាសាខ្មែរ"
          onChange={(event) => onChange({ nameKm: event.target.value })}
        />
      </label>

      {mapKind && (
        <fieldset className="plate-field">
          <legend className="plate-field__label">{t("plate.adj.basemap")}</legend>
          <div className="plate-basemaps">
            {BASEMAPS.filter((map) => map.kind === mapKind).map((map) => {
              const available = covers(map, plate.lat, plate.lon);
              return (
                <button
                  key={map.id}
                  type="button"
                  className="plate-basemap"
                  aria-pressed={activeMap?.id === map.id}
                  disabled={!available}
                  onClick={() => {
                    tapFeedback();
                    onChange({ basemap: map.id });
                  }}
                >
                  <strong>{map.name}</strong>
                  {map.region && (
                    <span>
                      {available ? map.region : `${map.region} · ${t("plate.adj.notHere")}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {activeMap?.daily && (
        <div className="plate-field">
          <label className="plate-field__label" htmlFor="plate-day">
            {t("plate.adj.day")}
          </label>
          <input
            id="plate-day"
            type="date"
            className="plate-input"
            min="2000-03-01"
            max={recentDay()}
            value={plate.imageryDate || recentDay()}
            onChange={(event) => onChange({ imageryDate: event.target.value })}
          />
          <div className="plate-chips">
            {SEASONS.map(({ id, month, day }) => {
              const date = `${new Date().getUTCFullYear() - 1}-${month}-${day}`;
              return (
                <button
                  key={id}
                  type="button"
                  className="plate-chip"
                  aria-pressed={plate.imageryDate === date}
                  onClick={() => onChange({ imageryDate: date })}
                >
                  {t(`plate.adj.season.${id}` as TranslationKey)}
                </button>
              );
            })}
          </div>
          <p className="plate-note">{t("plate.adj.dayHint")}</p>
        </div>
      )}

      <div className="plate-field">
        <div className="plate-field__row">
          <label className="plate-field__label" htmlFor="plate-sun">
            {t("plate.adj.sun")}
          </label>
          <output className="plate-field__value">
            {plate.sunHour ? clock(plate.sunHour) : t("plate.adj.studioLight")}
          </output>
          <button
            type="button"
            className="plate-chip"
            aria-pressed={plate.sunHour === 0}
            onClick={() => onChange({ sunHour: 0 })}
          >
            {t("plate.adj.studioLight")}
          </button>
        </div>
        <input
          id="plate-sun"
          type="range"
          className="plate-range"
          min={6}
          max={18}
          step={0.25}
          value={plate.sunHour || 12}
          onChange={(event) => onChange({ sunHour: Number(event.target.value) })}
        />
      </div>

      {plate.style === "elevation" && (
        <fieldset className="plate-field">
          <legend className="plate-field__label">{t("plate.adj.palette")}</legend>
          <div className="plate-palettes">
            {RELIEF_PALETTE_IDS.map((palette) => (
              <button
                key={palette}
                type="button"
                className="plate-palette"
                aria-pressed={plate.palette === palette}
                onClick={() => onChange({ palette })}
              >
                <span
                  className="plate-palette__swatch"
                  aria-hidden="true"
                  style={{ background: paletteGradient(palette) }}
                />
                {t(`plate.palette.${palette}` as TranslationKey)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="plate-field plate-group">
        <legend className="plate-field__label">{t("plate.adj.nameplate")}</legend>
        <label className="plate-switch">
          <input
            type="checkbox"
            checked={plate.label}
            onChange={(event) => onChange({ label: event.target.checked })}
          />
          <span>{t("plate.adj.showNameplate")}</span>
        </label>
        {plate.label && (
          <>
            <label className="plate-field">
              <span className="plate-field__label">{t("plate.adj.note")}</span>
              <input
                type="text"
                className="plate-input"
                value={plate.note}
                maxLength={60}
                placeholder={t("plate.adj.notePlaceholder")}
                onChange={(event) => onChange({ note: event.target.value })}
              />
            </label>
            <div
              className="plate-segmented plate-segmented--wide"
              role="group"
              aria-label={t("plate.adj.font")}
            >
              {LABEL_FONTS.map((labelFont) => (
                <button
                  key={labelFont}
                  type="button"
                  aria-pressed={plate.labelFont === labelFont}
                  data-font={labelFont}
                  onClick={() => onChange({ labelFont })}
                >
                  {t(`plate.font.${labelFont}` as TranslationKey)}
                </button>
              ))}
            </div>
            <div
              className="plate-segmented plate-segmented--wide"
              role="group"
              aria-label={t("plate.adj.letters")}
            >
              {LABEL_RELIEFS.map((labelRelief) => (
                <button
                  key={labelRelief}
                  type="button"
                  aria-pressed={plate.labelRelief === labelRelief}
                  onClick={() => onChange({ labelRelief })}
                >
                  {t(`plate.relief.${labelRelief}` as TranslationKey)}
                </button>
              ))}
            </div>
            <div className="plate-toggles">
              {(["labelCoords", "labelElevation", "labelCompass", "labelScale"] as const).map(
                (key) => (
                  <label key={key} className="plate-switch">
                    <input
                      type="checkbox"
                      checked={plate[key]}
                      onChange={(event) => onChange({ [key]: event.target.checked })}
                    />
                    <span>{t(`plate.adj.${key}` as TranslationKey)}</span>
                  </label>
                ),
              )}
            </div>
          </>
        )}
        <label className="plate-switch">
          <input
            type="checkbox"
            checked={plate.pin}
            onChange={(event) => onChange({ pin: event.target.checked })}
          />
          <span>{t("plate.adj.pin")}</span>
        </label>
      </fieldset>

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

      <fieldset className="plate-field plate-group">
        <legend className="plate-field__label">{t("plate.adj.season")}</legend>
        <label className="plate-switch">
          <input
            type="checkbox"
            checked={plate.buildings}
            onChange={(event) => onChange({ buildings: event.target.checked })}
          />
          <span>
            {t("plate.adj.buildings")}
            {plate.buildings && plate.sizeKm > 6 && (
              <small className="plate-switch__note">{t("plate.adj.buildingsSmall")}</small>
            )}
          </span>
        </label>
        <label className="plate-switch">
          <input
            type="checkbox"
            checked={plate.roads}
            onChange={(event) => onChange({ roads: event.target.checked })}
          />
          <span>{t("plate.adj.roads")}</span>
        </label>
        <label className="plate-switch">
          <input
            type="checkbox"
            checked={plate.lakes}
            onChange={(event) => onChange({ lakes: event.target.checked })}
          />
          <span>{t("plate.adj.lakes")}</span>
        </label>
        <label className="plate-switch">
          <input
            type="checkbox"
            checked={plate.snow > 0}
            onChange={(event) => onChange({ snow: event.target.checked ? 0.7 : 0 })}
          />
          <span>{t("plate.adj.snow")}</span>
        </label>
        {plate.snow > 0 && (
          <div className="plate-field">
            <div className="plate-field__row">
              <label className="plate-field__label" htmlFor="plate-snow">
                {t("plate.adj.snowLine")}
              </label>
              <output className="plate-field__value">{Math.round(plate.snow * 100)}%</output>
            </div>
            <input
              id="plate-snow"
              type="range"
              className="plate-range"
              min={0.3}
              max={0.95}
              step={0.01}
              value={plate.snow}
              onChange={(event) => onChange({ snow: Number(event.target.value) })}
            />
          </div>
        )}
        <div className="plate-field">
          <div className="plate-field__row">
            <label className="plate-field__label" htmlFor="plate-flood">
              {t("plate.adj.flood")}
            </label>
            <output className="plate-field__value">
              {plate.flood > 0 ? `+${plate.flood.toLocaleString("en-US")} m` : t("plate.adj.off")}
            </output>
          </div>
          <input
            id="plate-flood"
            type="range"
            className="plate-range"
            min={0}
            max={Math.max(1, Math.round(relief))}
            step={1}
            value={Math.min(plate.flood, Math.round(relief))}
            onChange={(event) => onChange({ flood: Number(event.target.value) })}
          />
        </div>
      </fieldset>

      {(["water", "strata"] as const).map((key) => (
        <label key={key} className="plate-switch">
          <input
            type="checkbox"
            checked={plate[key]}
            onChange={(event) => onChange({ [key]: event.target.checked })}
          />
          <span>{t(`plate.adj.${key}` as TranslationKey)}</span>
        </label>
      ))}

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
