import { useRef, useState } from "react";
import { Crosshair, Download, MapPin, Ruler, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/context/i18n/context";
import { notify } from "@/services/notify";
import { reportProblem } from "@/utils/reportProblem";
import { triggerDownloadBlob } from "@/services/export/fileDownloader";
import {
  MAX_MARKERS,
  encodeRoute,
  fitRoute,
  parseTrack,
  profileSvg,
  simplifyRoute,
  type Profile,
} from "../routes";
import type { PlateSettings } from "../plateSettings";
import PlateSheet from "./PlateSheet";

const ROUTE_COLORS = ["#e4572e", "#d6336c", "#1971c2", "#2f9e44", "#f08c00", "#1b1a17"];

interface RouteSheetProps {
  plate: PlateSettings;
  /** Profile of the route, or of the line drawn on the plate. */
  profile: Profile | null;
  profileTitle: string;
  onChange: (patch: Partial<PlateSettings>) => void;
  /** Close the sheet and wait for a tap on the plate. */
  onPick: (kind: "marker" | "line") => void;
  onClose: () => void;
}

export default function RouteSheet({
  plate,
  profile,
  profileTitle,
  onChange,
  onPick,
  onClose,
}: RouteSheetProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const importTrack = async (file: File) => {
    setBusy(true);
    try {
      const { name, points } = parseTrack(await file.text());
      const route = simplifyRoute(points);
      onChange({
        route: encodeRoute(route),
        ...fitRoute(route),
        ...(name && !plate.name.trim() ? { name: name.slice(0, 80) } : {}),
      });
      notify(t("plate.route.imported"), { tone: "success" });
    } catch {
      notify(t("plate.route.importFailed"), { tone: "error" });
      reportProblem("track-import");
    } finally {
      setBusy(false);
    }
  };

  const chart = profile
    ? profileSvg(profile, {
        ink: "#1b1a17",
        paper: "#fbfaf7",
        accent: plate.routeColor,
        title: profileTitle,
      })
    : "";

  return (
    <PlateSheet title={t("plate.route.title")} onClose={onClose} compact>
      <fieldset className="plate-field plate-group">
        <legend className="plate-field__label">{t("plate.route.track")}</legend>
        <input
          ref={fileRef}
          type="file"
          accept=".gpx,.kml,.geojson,.json,application/gpx+xml,application/vnd.google-earth.kml+xml,application/geo+json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importTrack(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="plate-btn plate-btn--soft"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={18} aria-hidden="true" />
          {plate.route ? t("plate.route.replace") : t("plate.route.import")}
        </button>
        <p className="plate-note">{t("plate.route.hint")}</p>
        {plate.route && (
          <>
            <div className="plate-route-colors" role="group" aria-label={t("plate.route.color")}>
              {ROUTE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="plate-route-color"
                  style={{ background: color }}
                  aria-pressed={plate.routeColor === color}
                  aria-label={color}
                  onClick={() => onChange({ routeColor: color })}
                />
              ))}
            </div>
            <label className="plate-switch">
              <input
                type="checkbox"
                checked={plate.routeRaise}
                onChange={(event) => onChange({ routeRaise: event.target.checked })}
              />
              <span>{t("plate.route.raise")}</span>
            </label>
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              onClick={() => onChange({ route: "" })}
            >
              <Trash2 size={18} aria-hidden="true" />
              {t("plate.route.remove")}
            </button>
          </>
        )}
      </fieldset>

      <fieldset className="plate-field plate-group">
        <legend className="plate-field__label">{t("plate.markers.title")}</legend>
        {plate.markers.map((marker, index) => (
          <div key={index} className="plate-marker-row">
            <MapPin size={18} aria-hidden="true" />
            <input
              type="text"
              className="plate-input"
              value={marker.label}
              maxLength={40}
              aria-label={`${t("plate.markers.name")} ${index + 1}`}
              placeholder={t("plate.markers.name")}
              onChange={(event) =>
                onChange({
                  markers: plate.markers.map((m, k) =>
                    k === index ? { ...m, label: event.target.value } : m,
                  ),
                })
              }
            />
            <button
              type="button"
              className="plate-icon-btn"
              aria-label={t("plate.markers.remove")}
              onClick={() => onChange({ markers: plate.markers.filter((_, k) => k !== index) })}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="plate-btn plate-btn--soft"
          disabled={plate.markers.length >= MAX_MARKERS}
          onClick={() => onPick("marker")}
        >
          <Crosshair size={18} aria-hidden="true" />
          {t("plate.markers.add")}
        </button>
      </fieldset>

      <fieldset className="plate-field plate-group">
        <legend className="plate-field__label">{t("plate.profile.title")}</legend>
        {chart ? (
          <>
            <div
              className="plate-profile"
              role="img"
              aria-label={profileTitle}
              // Our own SVG, built from numbers and an escaped title.
              dangerouslySetInnerHTML={{ __html: chart }}
            />
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              onClick={async () => {
                await triggerDownloadBlob(
                  new Blob([chart], { type: "image/svg+xml" }),
                  "teetang-profile.svg",
                );
                notify(t("plate.downloaded"), { tone: "success" });
              }}
            >
              <Download size={18} aria-hidden="true" />
              {t("plate.profile.download")}
            </button>
          </>
        ) : (
          <p className="plate-note">{t("plate.profile.empty")}</p>
        )}
        <button type="button" className="plate-btn plate-btn--soft" onClick={() => onPick("line")}>
          <Ruler size={18} aria-hidden="true" />
          {t("plate.profile.draw")}
        </button>
      </fieldset>
    </PlateSheet>
  );
}
