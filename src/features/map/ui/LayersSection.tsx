import MapDimensionFields from "./MapDimensionFields";
import { TILE_PROVIDERS } from "@/core/config";
import { useI18n } from "@/shared/i18n/context";

interface LayerForm {
  width: string;
  height: string;
  distance: string;
  tileProvider: string;
  includeLandcover: boolean;
  includeBuildings: boolean;
  includeWater: boolean;
  includeParks: boolean;
  includeAeroway: boolean;
  includeRail: boolean;
  includeRoads: boolean;
  includeRoadPath: boolean;
  includeRoadMinorLow: boolean;
  includeRoadOutline: boolean;
  focusCountry: boolean;
}

interface LayersSectionProps {
  form: LayerForm;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  minPosterCm: number;
  maxPosterCm: number;
  onNumericFieldBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
}

export default function LayersSection({
  form,
  onChange,
  minPosterCm,
  maxPosterCm,
  onNumericFieldBlur,
}: LayersSectionProps) {
  const { t } = useI18n();
  const isVectorTiles = form.tileProvider === "openfreemap";
  return (
    <section className="panel-block">
      <p className="section-summary-label">{t("layersSection")}</p>

      <p className="toggle-field">
        <span>{t("layers.baseMap")}</span>
        <span className="theme-select-wrapper">
          <select
            className="theme-select"
            name="tileProvider"
            value={form.tileProvider}
            onChange={onChange}
          >
            {TILE_PROVIDERS.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.label}
              </option>
            ))}
          </select>
        </span>
      </p>

      {isVectorTiles ? (
        <>
          <div className="ios-toggle-row">
            <span className="ios-toggle-label">{t("showLandcover")}</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                name="includeLandcover"
                checked={Boolean(form.includeLandcover)}
                onChange={onChange}
              />
              <span className="ios-track" />
            </label>
          </div>
          <div className="ios-toggle-row">
            <span className="ios-toggle-label">{t("showBuildings")}</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                name="includeBuildings"
                checked={Boolean(form.includeBuildings)}
                onChange={onChange}
              />
              <span className="ios-track" />
            </label>
          </div>
          <div className="ios-toggle-row">
            <span className="ios-toggle-label">{t("showWater")}</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                name="includeWater"
                checked={Boolean(form.includeWater)}
                onChange={onChange}
              />
              <span className="ios-track" />
            </label>
          </div>
          <div className="ios-toggle-row">
            <span className="ios-toggle-label">{t("showParks")}</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                name="includeParks"
                checked={Boolean(form.includeParks)}
                onChange={onChange}
              />
              <span className="ios-track" />
            </label>
          </div>
          <div className="ios-toggle-row">
            <span className="ios-toggle-label">{t("showRoads")}</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                name="includeRoads"
                checked={Boolean(form.includeRoads)}
                onChange={onChange}
              />
              <span className="ios-track" />
            </label>
          </div>
          <div className="ios-toggle-row">
            <span className="ios-toggle-label">{t("showRail")}</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                name="includeRail"
                checked={Boolean(form.includeRail)}
                onChange={onChange}
              />
              <span className="ios-track" />
            </label>
          </div>
          <div className="ios-toggle-row">
            <span className="ios-toggle-label">{t("showAeroway")}</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                name="includeAeroway"
                checked={Boolean(form.includeAeroway)}
                onChange={onChange}
              />
              <span className="ios-track" />
            </label>
          </div>
          <div className="ios-toggle-row">
            <span className="ios-toggle-label">{t("focusCountry")}</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                name="focusCountry"
                checked={Boolean(form.focusCountry)}
                onChange={onChange}
              />
              <span className="ios-track" />
            </label>
          </div>
        </>
      ) : null}

      <div className="map-details-section">
        
        <div className="map-details-card">
          <MapDimensionFields
            form={form}
            minPosterCm={minPosterCm}
            maxPosterCm={maxPosterCm}
            onChange={onChange}
            onNumericFieldBlur={onNumericFieldBlur}
            showSizeFields={false}
          />
        </div>
      </div>
    </section>
  );
}
