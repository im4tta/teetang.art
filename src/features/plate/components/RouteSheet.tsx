import { useRef, useState } from "react";
import {
  Crosshair,
  Download,
  Droplets,
  Eye,
  ImagePlus,
  MapPin,
  Plus,
  Ruler,
  Trash2,
  Upload,
} from "lucide-react";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import { notify } from "@/services/notify";
import { reportProblem } from "@/utils/reportProblem";
import { deletePhoto, savePhoto } from "../photos";
import { triggerDownloadBlob } from "@/services/export/fileDownloader";
import {
  MAX_MARKERS,
  decodeTracks,
  encodeTracks,
  pointsPerTrack,
  trackColor,
  fitRoute,
  parseTrack,
  profileSvg,
  simplifyRoute,
  type Profile,
} from "../routes";
import { VIEW_EYES, type PlateSettings } from "../plateSettings";
import PlateSheet from "./PlateSheet";

/** A pin index after pin `removed` is deleted: cleared if it was that pin, shifted if after it. */
const afterRemoval = (current: number, removed: number) =>
  current === removed ? -1 : current > removed ? current - 1 : current;

/** Days a trip can have; each shares the link's room for points. */
const MAX_DAYS = 5;

const ROUTE_COLORS = ["#e4572e", "#d6336c", "#1971c2", "#2f9e44", "#f08c00", "#1b1a17"];

interface RouteSheetProps {
  plate: PlateSettings;
  /** Profile of the route, or of the line drawn on the plate. */
  profile: Profile | null;
  profileTitle: string;
  /** Which day the profile shows; -1 for the whole trip. */
  profileDay: number;
  onProfileDay: (day: number) => void;
  /** What the chosen pin can see, once worked out. */
  view: { percent: number; farthestM: number } | null;
  /** Where rain from the chosen pin goes, once worked out. */
  rain: {
    lengthM: number;
    dropM: number;
    reachesSea: boolean;
    catchmentKm2: number;
    snapped: boolean;
  } | null;
  onChange: (patch: Partial<PlateSettings>) => void;
  /** Close the sheet and wait for a tap on the plate. */
  onPick: (kind: "marker" | "line") => void;
  onClose: () => void;
}

export default function RouteSheet({
  plate,
  profile,
  profileTitle,
  profileDay,
  onProfileDay,
  view,
  rain,
  onChange,
  onPick,
  onClose,
}: RouteSheetProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const days = plate.route ? decodeTracks(plate.route) : [];
  // Whether the next file replaces the trip or adds a day to it.
  const appendRef = useRef(false);

  const importTrack = async (file: File) => {
    setBusy(true);
    try {
      const { name, points } = parseTrack(await file.text());
      const raw = appendRef.current ? [...days, points] : [points];
      // Each day gets a share of the points, so the whole trip still fits a link.
      const trip = raw.map((track) => simplifyRoute(track, pointsPerTrack(raw.length)));
      onChange({
        route: encodeTracks(trip),
        ...fitRoute(trip.flat()),
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
          onClick={() => {
            appendRef.current = false;
            fileRef.current?.click();
          }}
        >
          <Upload size={18} aria-hidden="true" />
          {plate.route ? t("plate.route.replace") : t("plate.route.import")}
        </button>
        {days.length > 0 && (
          <>
            <ol className="plate-days">
              {days.map((track, index) => (
                <li key={index}>
                  <i
                    style={{ background: trackColor(index, plate.routeColor) }}
                    aria-hidden="true"
                  />
                  <span>
                    {t("plate.route.day")} {index + 1}
                  </span>
                  <button
                    type="button"
                    className="plate-icon-btn"
                    aria-label={`${t("plate.route.removeDay")} ${index + 1}`}
                    onClick={() =>
                      onChange({ route: encodeTracks(days.filter((_, k) => k !== index)) })
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              disabled={busy || days.length >= MAX_DAYS}
              onClick={() => {
                appendRef.current = true;
                fileRef.current?.click();
              }}
            >
              <Plus size={18} aria-hidden="true" />
              {t("plate.route.addDay")}
            </button>
          </>
        )}
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
              aria-pressed={plate.viewFrom === index}
              aria-label={`${t("plate.view.from")} ${marker.label || index + 1}`}
              title={t("plate.view.from")}
              onClick={() => onChange({ viewFrom: plate.viewFrom === index ? -1 : index })}
            >
              <Eye size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="plate-icon-btn"
              aria-pressed={plate.rainFrom === index}
              aria-label={`${t("plate.rain.from")} ${marker.label || index + 1}`}
              title={t("plate.rain.from")}
              onClick={() => onChange({ rainFrom: plate.rainFrom === index ? -1 : index })}
            >
              <Droplets size={18} aria-hidden="true" />
            </button>
            <label
              className="plate-icon-btn plate-marker-photo"
              data-has-photo={marker.photo ? "true" : undefined}
              aria-label={
                marker.photo ? t("plate.markers.changePhoto") : t("plate.markers.addPhoto")
              }
              title={marker.photo ? t("plate.markers.changePhoto") : t("plate.markers.addPhoto")}
            >
              <ImagePlus size={18} aria-hidden="true" />
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    const photo = await savePhoto(file);
                    if (marker.photo) void deletePhoto(marker.photo);
                    onChange({
                      markers: plate.markers.map((m, k) => (k === index ? { ...m, photo } : m)),
                    });
                  } catch {
                    notify(t("plate.markers.photoFailed"), { tone: "error" });
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="plate-icon-btn"
              aria-label={t("plate.markers.remove")}
              onClick={() => {
                if (marker.photo) void deletePhoto(marker.photo);
                onChange({
                  markers: plate.markers.filter((_, k) => k !== index),
                  viewFrom: afterRemoval(plate.viewFrom, index),
                  rainFrom: afterRemoval(plate.rainFrom, index),
                });
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {plate.markers[plate.viewFrom] && (
          <div className="plate-field" data-testid="view-panel">
            <div className="plate-chips" role="group" aria-label={t("plate.view.eye")}>
              {VIEW_EYES.map((metres) => (
                <button
                  key={metres}
                  type="button"
                  className="plate-chip"
                  aria-pressed={plate.viewEye === metres}
                  onClick={() => onChange({ viewEye: metres })}
                >
                  {t(`plate.view.eye${metres}` as TranslationKey)}
                </button>
              ))}
            </div>
            <p className="plate-note" role="status">
              {view
                ? `${t("plate.view.sees")} ${view.percent}% · ${t("plate.view.farthest")} ${(view.farthestM / 1000).toFixed(1)} km`
                : t("plate.view.off")}
            </p>
            <p className="plate-note">{t("plate.view.note")}</p>
          </div>
        )}
        {plate.markers[plate.rainFrom] && (
          <div className="plate-field" data-testid="rain-panel">
            <p className="plate-note" role="status">
              {rain
                ? `${t(rain.reachesSea ? "plate.rain.toSea" : "plate.rain.toEdge")} ${(rain.lengthM / 1000).toFixed(1)} km · ${t("plate.rain.drops")} ${Math.round(rain.dropM).toLocaleString("en-US")} m`
                : t("plate.view.off")}
            </p>
            {rain && (
              <p className="plate-note">
                {t("plate.rain.catchment")}{" "}
                {rain.catchmentKm2 < 10
                  ? rain.catchmentKm2.toFixed(1)
                  : Math.round(rain.catchmentKm2)}{" "}
                km²
              </p>
            )}
            {rain?.snapped && <p className="plate-note">{t("plate.rain.snapped")}</p>}
            <p className="plate-note">{t("plate.rain.note")}</p>
          </div>
        )}
        {plate.markers.some((marker) => marker.photo) && (
          <p className="plate-note">{t("plate.markers.photoNote")}</p>
        )}
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
        {days.length > 1 && (
          <div className="plate-chips" role="group" aria-label={t("plate.profile.title")}>
            {[-1, ...days.map((_, k) => k)].map((day) => (
              <button
                key={day}
                type="button"
                className="plate-chip"
                aria-pressed={profileDay === day}
                onClick={() => onProfileDay(day)}
              >
                {day < 0 ? t("plate.route.wholeTrip") : `${t("plate.route.day")} ${day + 1}`}
              </button>
            ))}
          </div>
        )}
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
