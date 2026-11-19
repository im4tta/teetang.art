import {
  lazy,
  Suspense,
  type CSSProperties,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { Dices, Download, Move, Share2, SlidersHorizontal, MapPinned } from "lucide-react";
import { I18nProvider, useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import Toaster from "@/components/ui/Toaster";
import { notify } from "@/services/notify";
import { copyText, shareOrCopy } from "@/services/share/shareSheet";
import { triggerDownloadBlob } from "@/services/export/fileDownloader";
import { tapFeedback } from "@/utils/haptics";
import type { SearchResult } from "@/services/location/types";
import { plateBounds } from "@/features/plate/geo";
import { loadHeightGrid } from "@/features/plate/elevation";
import type { HeightGrid } from "@/features/plate/elevationCore";
import { autoExaggeration, buildPlateGeometry } from "@/features/plate/geometry";
import {
  DEFAULT_PLATE,
  DENSITY_LINES,
  PLATE_STYLES,
  PICKER_BASES,
  SIZE_PRESETS,
  type PickerBase,
  sizeToSlider,
  sliderToSize,
  buildPlateLink,
  flagEmoji,
  parsePlateLink,
  readPlateDraft,
  writePlateDraft,
  type PlateSettings,
} from "@/features/plate/plateSettings";
import { pickSurprise } from "@/features/plate/surprisePlaces";
import { SATELLITE_CREDIT, loadMapDrape, loadSatelliteDrape } from "@/features/plate/drape";
import PlateView, { type PlateViewHandle } from "@/features/plate/components/PlateView";
import PlaceSearch from "@/features/plate/components/PlaceSearch";
import type { AreaChange } from "@/features/plate/components/AreaPicker";
import type { PlateDownload } from "@/features/plate/components/DownloadSheet";
import "@/styles/plate.css";

const AreaPicker = lazy(() => import("@/features/plate/components/AreaPicker"));
const AdjustSheet = lazy(() => import("@/features/plate/components/AdjustSheet"));
const DownloadSheet = lazy(() => import("@/features/plate/components/DownloadSheet"));

const GRID_CELLS = (navigator.hardwareConcurrency ?? 8) <= 4 ? 192 : 256;
const DRAFT_DELAY_MS = 400;

/** How this viewer likes the Move map; kept in this browser only. */
interface PickerPrefs {
  base: PickerBase;
  dim: number;
}
const PICKER_PREFS_KEY = "teetangart.plate.picker";

function readPickerPrefs(): PickerPrefs {
  const fallback: PickerPrefs = { base: "map", dim: 0.25 };
  try {
    const saved = JSON.parse(window.localStorage.getItem(PICKER_PREFS_KEY) ?? "null");
    return {
      base: PICKER_BASES.includes(saved?.base) ? saved.base : fallback.base,
      dim: typeof saved?.dim === "number" ? Math.min(0.8, Math.max(0, saved.dim)) : fallback.dim,
    };
  } catch {
    return fallback;
  }
}

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ready"; value: T };

function initialPlate(): PlateSettings {
  const fromLink = parsePlateLink(window.location.search);
  if (fromLink) {
    window.history.replaceState(window.history.state, "", "/plate");
    return { ...DEFAULT_PLATE, ...fromLink };
  }
  return { ...DEFAULT_PLATE, ...readPlateDraft() };
}

const slug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "plate";

const formatMetres = (metres: number) => `${Math.round(metres).toLocaleString("en-US")} m`;

function PlateApp() {
  const { t, lang, toggleLang } = useI18n();
  const [plate, setPlate] = useState<PlateSettings>(initialPlate);
  const [mode, setMode] = useState<"plate" | "move">("plate");
  const [area, setArea] = useState<AreaChange | null>(null);
  const [picker, setPicker] = useState<PickerPrefs>(readPickerPrefs);
  const [sheet, setSheet] = useState<"adjust" | "download" | null>(null);
  const [terrain, setTerrain] = useState<Load<HeightGrid>>({ status: "loading" });
  const [drape, setDrape] = useState<Load<HTMLCanvasElement> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [touched, setTouched] = useState(false);
  const viewRef = useRef<PlateViewHandle>(null);

  const update = useCallback((patch: Partial<PlateSettings>) => {
    setPlate((current) => ({ ...current, ...patch }));
  }, []);

  const bounds = useMemo(
    () => plateBounds(plate.lat, plate.lon, plate.sizeKm),
    [plate.lat, plate.lon, plate.sizeKm],
  );

  // Terrain for the current square.
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setTerrain({ status: "loading" }));
    loadHeightGrid(bounds, GRID_CELLS, controller.signal).then(
      (value) => setTerrain({ status: "ready", value }),
      () => !controller.signal.aborted && setTerrain({ status: "error" }),
    );
    return () => controller.abort();
  }, [bounds, attempt]);

  // Map or satellite image over the terrain.
  const needsDrape = plate.style === "map" || plate.style === "satellite";
  useEffect(() => {
    if (!needsDrape) {
      queueMicrotask(() => setDrape(null));
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => setDrape({ status: "loading" }));
    (plate.style === "map"
      ? loadMapDrape(bounds, plate.theme, controller.signal)
      : loadSatelliteDrape(bounds, controller.signal)
    ).then(
      (value) => setDrape({ status: "ready", value }),
      () => {
        if (controller.signal.aborted) return;
        setDrape({ status: "error" });
        notify(t("plate.drapeError"), { tone: "error", id: "plate-drape" });
      },
    );
    return () => controller.abort();
  }, [needsDrape, plate.style, plate.theme, bounds, t]);

  const deferred = useDeferredValue(plate);
  const grid = terrain.status === "ready" ? terrain.value : null;
  const autoHeight = useMemo(
    () => (grid ? autoExaggeration(grid, bounds.sizeMeters) : 1),
    [grid, bounds.sizeMeters],
  );
  const geometry = useMemo(
    () =>
      grid
        ? buildPlateGeometry(grid, {
            shape: deferred.shape,
            exaggeration: deferred.exaggeration || autoHeight,
            sizeMeters: bounds.sizeMeters,
            boxDepth: deferred.box,
          })
        : null,
    [grid, deferred.shape, deferred.exaggeration, deferred.box, autoHeight, bounds.sizeMeters],
  );

  const drapeReady = drape?.status === "ready" ? drape.value : null;
  // While imagery loads, or if it fails, the plate shows its line drawing.
  const look = useMemo(
    () => ({
      style: needsDrape && !drapeReady ? ("drawing" as const) : plate.style,
      ink: plate.ink,
      paper: plate.paper,
      side: plate.side,
      shadow: plate.shadow,
      lines: DENSITY_LINES[plate.density],
    }),
    [
      needsDrape,
      drapeReady,
      plate.style,
      plate.ink,
      plate.paper,
      plate.side,
      plate.shadow,
      plate.density,
    ],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(PICKER_PREFS_KEY, JSON.stringify(picker));
    } catch {
      // Preferences are a convenience; the picker works without them.
    }
  }, [picker]);

  useEffect(() => {
    const timer = setTimeout(() => writePlateDraft(plate), DRAFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [plate]);

  const goTo = useCallback(
    (place: Partial<PlateSettings> & { lat: number; lon: number }) => {
      tapFeedback();
      setArea(null);
      update(place);
    },
    [update],
  );

  const handleSearch = (result: SearchResult) =>
    goTo({
      lat: result.lat,
      lon: result.lon,
      name: result.shortLabel,
      region: result.city && result.city !== result.shortLabel ? result.city : "",
      country: result.country,
      countryCode: result.countryCode ?? "",
    });

  const showPlate = async () => {
    setMode("plate");
    if (!area) return;
    const moved = Math.hypot(area.lat - plate.lat, area.lon - plate.lon) * 111 > plate.sizeKm / 4;
    update({ lat: area.lat, lon: area.lon, sizeKm: area.sizeKm });
    setArea(null);
    if (!moved) return;
    try {
      const { reverseGeocodeCoordinates } = await import("@/services/container");
      const place = await reverseGeocodeCoordinates(area.lat, area.lon);
      update({
        name: place.shortLabel,
        region: place.city && place.city !== place.shortLabel ? place.city : "",
        country: place.country,
        countryCode: place.countryCode ?? "",
      });
    } catch {
      update({ name: "", region: "", country: "", countryCode: "" });
    }
  };

  const title = plate.name || t("plate.untitled");
  const subtitle = [plate.region, plate.country].filter(Boolean).join(", ");
  const highest = geometry ? formatMetres(geometry.max) : "";

  const download = async (kind: PlateDownload) => {
    if (kind === "link") {
      const outcome = await copyText(buildPlateLink(plate));
      notify(outcome === "copied" ? t("plate.linkCopied") : t("plate.downloadFailed"), {
        tone: outcome === "copied" ? "success" : "error",
      });
      return;
    }
    if (!geometry) return;
    const name = `teetang-plate-${slug(plate.name)}`;
    const caption = {
      title: title.toUpperCase(),
      subtitle: [subtitle, highest].filter(Boolean).join(" · "),
    };
    try {
      let blob: Blob;
      if (kind === "png") {
        const shot = viewRef.current?.snapshot(window.innerWidth >= 900 ? 3072 : 2048);
        if (!shot) throw new Error("No image");
        blob = await composePoster(shot, plate, caption, plate.style === "satellite");
      } else {
        const files = await import("@/features/plate/plateFiles");
        blob =
          kind === "svg"
            ? new Blob(
                [files.buildContourSvg(geometry, { ink: plate.ink, paper: plate.paper, caption })],
                {
                  type: "image/svg+xml",
                },
              )
            : new Blob([files.buildStl(geometry)], { type: "model/stl" });
      }
      await triggerDownloadBlob(blob, `${name}.${kind}`);
      notify(t("plate.downloaded"), { tone: "success" });
    } catch {
      notify(t("plate.downloadFailed"), { tone: "error" });
    }
  };

  const share = async () => {
    const outcome = await shareOrCopy({
      title: `${title} · teetang.art`,
      url: buildPlateLink(plate),
    });
    if (outcome === "copied") notify(t("plate.linkCopied"), { tone: "success" });
    if (outcome === "failed") notify(t("plate.downloadFailed"), { tone: "error" });
  };

  const pickerArea = area ?? { lat: plate.lat, lon: plate.lon, sizeKm: plate.sizeKm };
  const posterLink = `/create?lat=${plate.lat.toFixed(5)}&lon=${plate.lon.toFixed(5)}&city=${encodeURIComponent(plate.name)}&country=${encodeURIComponent(plate.country)}`;

  return (
    <div className="plate-page">
      <header className="plate-header">
        <Link to="/" className="plate-brand" aria-label={t("plate.home")}>
          <img src="/assets/logo.svg" alt="" width={28} height={28} />
          <span>teetang.art</span>
        </Link>
        <span className="plate-header__title">{t("plate.title")}</span>
        <button
          type="button"
          className="plate-icon-btn plate-lang"
          onClick={toggleLang}
          aria-label={lang === "en" ? "Switch to Khmer" : "ប្ដូរទៅអង់គ្លេស"}
        >
          {lang === "en" ? "KH" : "EN"}
        </button>
      </header>

      <main className="plate-main">
        <section className="plate-stage" data-mode={mode} aria-busy={terrain.status === "loading"}>
          {mode === "move" ? (
            <Suspense fallback={<div className="plate-stage__loading" />}>
              <div className="area-picker-frame" style={{ "--dim": picker.dim } as CSSProperties}>
                <AreaPicker
                  {...pickerArea}
                  base={picker.base}
                  onBaseChange={(base) => setPicker((current) => ({ ...current, base }))}
                  onChange={setArea}
                />
              </div>
            </Suspense>
          ) : (
            <>
              <PlateView
                ref={viewRef}
                geometry={geometry}
                look={look}
                drape={drapeReady}
                label={`${title} ${subtitle}`}
                onInteract={() => setTouched(true)}
              />
              {terrain.status === "loading" && (
                <div className="plate-stage__loading" role="status">
                  <span className="plate-spinner" aria-hidden="true" />
                  {t("plate.loading")}
                </div>
              )}
              {terrain.status === "error" && (
                <div className="plate-stage__message" role="alert">
                  <p>{t("plate.error")}</p>
                  <button
                    type="button"
                    className="plate-btn"
                    onClick={() => setAttempt((n) => n + 1)}
                  >
                    {t("plate.retry")}
                  </button>
                </div>
              )}
              {drape?.status === "loading" && terrain.status === "ready" && (
                <div className="plate-stage__pill" role="status">
                  <span className="plate-spinner" aria-hidden="true" />
                  {t("plate.loadingImagery")}
                </div>
              )}
              {!touched && geometry && <p className="plate-stage__hint">{t("plate.dragHint")}</p>}
            </>
          )}
          <p className="plate-credit">
            Elevation: AWS Terrain Tiles
            {plate.style === "satellite" && mode === "plate" ? ` · ${SATELLITE_CREDIT}` : ""}
            {mode === "plate" && plate.style === "map" ? " · © OpenStreetMap contributors" : ""}
          </p>
        </section>

        <section className="plate-panel">
          <div className="plate-place">
            <h1
              className="plate-place__name"
              data-script={/[\u1780-\u17ff]/.test(title) ? "khmer" : undefined}
            >
              {title}
            </h1>
            <p className="plate-place__meta">
              {plate.countryCode && <span aria-hidden="true">{flagEmoji(plate.countryCode)} </span>}
              {subtitle}
              {subtitle && highest ? " · " : ""}
              {highest && (
                <span title={t("plate.highest")}>
                  {highest} <small>{t("plate.highest")}</small>
                </span>
              )}
            </p>
          </div>

          {mode === "move" ? (
            <>
              <div className="plate-bar">
                <label className="plate-size">
                  <span className="visually-hidden">{t("plate.areaSize")}</span>
                  <input
                    type="range"
                    className="plate-range"
                    min={0}
                    max={100}
                    step={0.5}
                    value={sizeToSlider(pickerArea.sizeKm)}
                    onChange={(event) =>
                      setArea({ ...pickerArea, sizeKm: sliderToSize(Number(event.target.value)) })
                    }
                  />
                  <output>{pickerArea.sizeKm} km</output>
                </label>
                <button type="button" className="plate-btn plate-btn--light" onClick={showPlate}>
                  {t("plate.showPlate")}
                </button>
              </div>
              <div className="plate-chips" role="group" aria-label={t("plate.areaSize")}>
                {SIZE_PRESETS.map((km) => (
                  <button
                    key={km}
                    type="button"
                    className="plate-chip"
                    aria-pressed={pickerArea.sizeKm === km}
                    onClick={() => setArea({ ...pickerArea, sizeKm: km })}
                  >
                    {km} km
                  </button>
                ))}
              </div>
              <label className="plate-dim">
                <span>{t("plate.dim")}</span>
                <input
                  type="range"
                  className="plate-range"
                  min={0}
                  max={0.8}
                  step={0.05}
                  value={picker.dim}
                  onChange={(event) =>
                    setPicker((current) => ({ ...current, dim: Number(event.target.value) }))
                  }
                />
                <output>{Math.round(picker.dim * 100)}%</output>
              </label>
            </>
          ) : (
            <div className="plate-bar" role="toolbar" aria-label={t("plate.styles")}>
              <button type="button" className="plate-move" onClick={() => setMode("move")}>
                <Move size={20} aria-hidden="true" />
                <span>{t("plate.move")}</span>
              </button>
              <div className="plate-segmented" role="group" aria-label={t("plate.styles")}>
                {PLATE_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    aria-pressed={plate.style === style}
                    onClick={() => {
                      tapFeedback();
                      update({ style });
                    }}
                  >
                    {t(`plate.style.${style}` as TranslationKey)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <PlaceSearch onSelect={handleSearch} />

          <div className="plate-actions">
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              onClick={() => {
                const { sizeKm, ...place } = pickSurprise(plate.name);
                goTo({ ...place, sizeKm });
              }}
            >
              <Dices size={20} aria-hidden="true" />
              {t("plate.surprise")}
            </button>
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              onClick={() => setSheet("adjust")}
            >
              <SlidersHorizontal size={20} aria-hidden="true" />
              {t("plate.adjust")}
            </button>
          </div>

          <div className="plate-cta">
            <button
              type="button"
              className="plate-btn plate-btn--primary"
              disabled={!geometry || mode === "move"}
              onClick={() => setSheet("download")}
            >
              <Download size={20} aria-hidden="true" />
              {t("plate.download")}
            </button>
            <button
              type="button"
              className="plate-icon-btn plate-icon-btn--large"
              onClick={share}
              aria-label={t("plate.share")}
            >
              <Share2 size={22} />
            </button>
          </div>

          <Link to={posterLink} className="plate-poster-link">
            <MapPinned size={18} aria-hidden="true" />
            {t("plate.makePoster")}
          </Link>
        </section>
      </main>

      <Suspense fallback={null}>
        {sheet === "adjust" && (
          <AdjustSheet
            plate={plate}
            autoExaggeration={autoHeight}
            onChange={update}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === "download" && (
          <DownloadSheet
            onDownload={download}
            onClose={() => setSheet(null)}
            satellite={plate.style === "satellite"}
          />
        )}
      </Suspense>
      <Toaster />
    </div>
  );
}

/** The plate image with a caption underneath, on the plate's own paper colour. */
async function composePoster(
  shot: HTMLCanvasElement,
  plate: PlateSettings,
  caption: { title: string; subtitle: string },
  satellite: boolean,
): Promise<Blob> {
  const size = shot.width;
  const canvas = Object.assign(document.createElement("canvas"), {
    width: size,
    height: Math.round(size * 1.25),
  });
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = plate.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Crop the plate to its visible pixels and centre it above the caption.
  const { data } = shot.getContext("2d")!.getImageData(0, 0, size, size);
  let left = size,
    right = 0,
    top = size,
    bottom = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] < 8) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right > left && bottom > top) {
    const width = right - left + 1;
    const height = bottom - top + 1;
    const scale = Math.min((size * 0.84) / width, (size * 0.86) / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    ctx.drawImage(
      shot,
      left,
      top,
      width,
      height,
      (size - drawWidth) / 2,
      size * 0.52 - drawHeight / 2,
      drawWidth,
      drawHeight,
    );
  }
  ctx.fillStyle = plate.ink;
  ctx.textAlign = "center";
  const unit = size / 1000;
  ctx.font = `500 ${46 * unit}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  ctx.letterSpacing = `${10 * unit}px`;
  ctx.fillText(caption.title, size / 2, size + 95 * unit);
  ctx.font = `400 ${22 * unit}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
  ctx.letterSpacing = `${3 * unit}px`;
  ctx.fillText(caption.subtitle, size / 2, size + 145 * unit);
  ctx.globalAlpha = 0.55;
  ctx.font = `400 ${13 * unit}px ui-monospace, Menlo, monospace`;
  ctx.letterSpacing = "0px";
  ctx.fillText(
    `${plate.lat.toFixed(4)}°, ${plate.lon.toFixed(4)}° · ${plate.sizeKm} km · teetang.art${satellite ? ` · ${SATELLITE_CREDIT}` : ""}`,
    size / 2,
    canvas.height - 40 * unit,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png",
    ),
  );
}

export default function PlatePage() {
  return (
    <I18nProvider>
      <PlateApp />
    </I18nProvider>
  );
}
