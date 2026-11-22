import { useState } from "react";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import { plateBounds } from "../geo";
import type { ElevationMeta } from "../elevationCore";
import { ELEVATION_SOURCES, isOpenTopoKey, saveOpenTopoKey, sourceById } from "../elevationSources";
import type { PlateSettings } from "../plateSettings";

interface ElevationSourceFieldProps {
  plate: PlateSettings;
  /** What the loaded terrain was actually built from. */
  meta: ElevationMeta | undefined;
  /** The visitor's own OpenTopography key; never part of a link. */
  openTopoKey: string;
  onKey: (key: string) => void;
  onChange: (patch: Partial<PlateSettings>) => void;
}

/** Where the plate's heights come from, with the dataset actually in use. */
export default function ElevationSourceField({
  plate,
  meta,
  openTopoKey,
  onKey,
  onChange,
}: ElevationSourceFieldProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [keyError, setKeyError] = useState(false);
  const bounds = plateBounds(plate.lat, plate.lon, plate.sizeKm);
  const chosen = sourceById(plate.elevation);
  const needsKey = chosen?.needsKey && !openTopoKey;

  const using = meta?.label
    ? `${meta.label}${meta.resolutionM ? ` · ~${Math.round(meta.resolutionM)} m` : ""}`
    : null;

  return (
    <fieldset className="plate-field plate-group">
      <legend className="plate-field__label">{t("plate.dem.title")}</legend>
      <div className="plate-basemaps">
        {ELEVATION_SOURCES.map((source) => {
          const here = source.covers(bounds);
          return (
            <button
              key={source.id || "default"}
              type="button"
              className="plate-basemap"
              aria-pressed={plate.elevation === source.id}
              disabled={!here}
              onClick={() => onChange({ elevation: source.id })}
            >
              <strong>{source.name}</strong>
              <span>
                {here ? `~${source.resolutionM} m` : `${t("plate.adj.notHere")}`}
                {source.needsKey ? ` · ${t("plate.dem.needsKey")}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {using && (
        <p className="plate-note" data-testid="elevation-using">
          {t("plate.dem.using")}: <strong>{using}</strong>
        </p>
      )}
      {meta?.fellBack && (
        <p className="plate-note plate-note--warn" role="status">
          {t(`plate.dem.fell.${meta.fellBack}` as TranslationKey)}
        </p>
      )}
      {!plate.elevation && meta?.resolutionM && meta.resolutionM >= 25 && (
        <p className="plate-note">{t("plate.dem.tip")}</p>
      )}

      {chosen?.needsKey && (
        <div className="plate-field">
          <label className="plate-field__label" htmlFor="plate-dem-key">
            {t("plate.dem.key")}
          </label>
          <div className="plate-row">
            <input
              id="plate-dem-key"
              type="password"
              className="plate-input"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              placeholder={openTopoKey ? "••••••••••••••••" : ""}
              onChange={(event) => {
                setDraft(event.target.value.trim());
                setKeyError(false);
              }}
            />
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              disabled={!draft && !openTopoKey}
              onClick={() => {
                if (!draft) {
                  saveOpenTopoKey("");
                  onKey("");
                  return;
                }
                if (!isOpenTopoKey(draft) || !saveOpenTopoKey(draft)) {
                  setKeyError(true);
                  return;
                }
                onKey(draft);
                setDraft("");
              }}
            >
              {draft || !openTopoKey ? t("plate.dem.keySave") : t("plate.dem.keyRemove")}
            </button>
          </div>
          {keyError && (
            <p className="plate-note plate-note--warn" role="alert">
              {t("plate.dem.keyInvalid")}
            </p>
          )}
          <p className="plate-note">
            {needsKey ? t("plate.dem.fell.key") : t("plate.dem.keySaved")} {t("plate.dem.keyHint")}{" "}
            <a href="https://opentopography.org/developers" target="_blank" rel="noopener">
              opentopography.org
            </a>
          </p>
        </div>
      )}
    </fieldset>
  );
}
