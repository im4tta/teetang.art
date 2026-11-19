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
import { Link, useNavigate } from "react-router-dom";
import {
  Box,
  Camera,
  Dices,
  Download,
  Move,
  Route,
  Share2,
  SlidersHorizontal,
  MapPinned,
} from "lucide-react";
import { I18nProvider, useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import Toaster from "@/components/ui/Toaster";
import { notify } from "@/services/notify";
import { copyText, shareOrCopy } from "@/services/share/shareSheet";
import { triggerDownloadBlob } from "@/services/export/fileDownloader";
import { tapFeedback } from "@/utils/haptics";
import { useWheelScrollsRows } from "@/hooks/useWheelScrollsRows";
import type { SearchResult } from "@/services/location/types";
import { plateBounds, plateToLonLat } from "@/features/plate/geo";
import {
  decodeRoute,
  drawOverlay,
  elevationProfile,
  routeMask,
  toPlateUv,
  type LatLon,
} from "@/features/plate/routes";
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
  plateLabel,
  readPlateDraft,
  writePlateDraft,
  type PlateSettings,
} from "@/features/plate/plateSettings";
import { pickSurprise } from "@/features/plate/surprisePlaces";
import { loadMapDrape, loadTileDrape, loadWaterMask, maskToGrid } from "@/features/plate/drape";
import { resolveBasemap, type Basemap } from "@/features/plate/basemaps";
import { buildPlateExtras, type PlateExtras } from "@/features/plate/extras";
import type { PhotoInput } from "@/features/plate/photo";
import PlateView, { type PlateViewHandle } from "@/features/plate/components/PlateView";
import PlaceSearch from "@/features/plate/components/PlaceSearch";
import type { AreaChange } from "@/features/plate/components/AreaPicker";
import type { PlateDownload } from "@/features/plate/components/DownloadSheet";
import "@/styles/plate.css";

const AreaPicker = lazy(() => import("@/features/plate/components/AreaPicker"));
const AdjustSheet = lazy(() => import("@/features/plate/components/AdjustSheet"));
const DownloadSheet = lazy(() => import("@/features/plate/components/DownloadSheet"));
const PhotoView = lazy(() => import("@/features/plate/components/PhotoView"));
const RouteSheet = lazy(() => import("@/features/plate/components/RouteSheet"));

const LOW_END = (navigator.hardwareConcurrency ?? 8) <= 4;
/** The quick first plate: few tiles to fetch, so it shows almost at once. */
const PREVIEW_CELLS = 64;
const GRID_CELLS = LOW_END ? 192 : 256;
const DRAFT_DELAY_MS = 400;
/** Nameplate grid cells per plate width: about 0.3 mm on a 10 cm print. */
const LABEL_CELLS = LOW_END ? 240 : 340;
const EXTRAS_DELAY_MS = 120;

/** The raster map behind a style, or null for styles drawn from the terrain alone. */
function basemapFor(plate: PlateSettings): Basemap | null {
  if (plate.style === "satellite")
    return resolveBasemap("imagery", plate.basemap, plate.lat, plate.lon);
  if (plate.style === "topo") return resolveBasemap("topo", plate.basemap, plate.lat, plate.lon);
  return null;
}

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

const COMPASS = ["e", "ne", "n", "nw", "w", "sw", "s", "se"] as const;

/** What a screen reader says about the plate: its highest and lowest points and where the summit is. */
function describePlate(
  t: (key: TranslationKey) => string,
  title: string,
  geometry: { max: number; min: number; peak: { u: number; v: number } },
): string {
  const dx = geometry.peak.u - 0.5;
  const dy = 0.5 - geometry.peak.v;
  const where =
    Math.hypot(dx, dy) < 0.12
      ? t("plate.dir.centre")
      : t(
          `plate.dir.${COMPASS[Math.round(Math.atan2(dy, dx) / (Math.PI / 4) + 8) % 8]}` as TranslationKey,
        );
  return t("plate.a11y.summary")
    .replace("{title}", title)
    .replace("{max}", formatMetres(geometry.max))
    .replace("{where}", where)
    .replace("{min}", formatMetres(geometry.min));
}

/** The page's background colour, so the photo's studio backdrop blends in. */
function stageBackdrop(): string {
  const page = document.querySelector(".plate-page");
  const value = page ? getComputedStyle(page).getPropertyValue("--plate-bg").trim() : "";
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#f1efe9";
}

/** Rows that scroll sideways; the mouse wheel scrolls them too. */
const SIDEWAYS_ROWS = ".plate-segmented, .plate-chips, .plate-theme-row";

const formatMetres = (metres: number) => `${Math.round(metres).toLocaleString("en-US")} m`;

function PlateApp() {
  const { t, lang, toggleLang } = useI18n();
  const [plate, setPlate] = useState<PlateSettings>(initialPlate);
  const [mode, setMode] = useState<"plate" | "move">("plate");
  const [area, setArea] = useState<AreaChange | null>(null);
  const [picker, setPicker] = useState<PickerPrefs>(readPickerPrefs);
  const [sheet, setSheet] = useState<"adjust" | "download" | "route" | null>(null);
  /** Waiting for a tap on the plate: to drop a marker, or the two ends of a measuring line. */
  const [picking, setPicking] = useState<
    null | { kind: "marker" } | { kind: "line"; first: LatLon | null }
  >(null);
  const [measure, setMeasure] = useState<LatLon[] | null>(null);
  const [terrain, setTerrain] = useState<Load<HeightGrid>>({ status: "loading" });
  const [drape, setDrape] = useState<Load<HTMLCanvasElement> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [touched, setTouched] = useState(false);
  const [extras, setExtras] = useState<PlateExtras | null>(null);
  const [fullDetail, setFullDetail] = useState(false);
  const [photo, setPhoto] = useState<PhotoInput | null>(null);
  const viewRef = useRef<PlateViewHandle>(null);
  const navigate = useNavigate();
  const stylesRef = useRef<HTMLDivElement>(null);
  useWheelScrollsRows(SIDEWAYS_ROWS);

  // Keep the chosen style in sight when the style row is wider than the panel.
  useEffect(() => {
    const row = stylesRef.current;
    const chosen = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chosen) return;
    const left = chosen.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chosen.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: left - (row.clientWidth - chosen.offsetWidth) / 2, behavior: "smooth" });
    }
  }, [plate.style, mode]);

  const update = useCallback((patch: Partial<PlateSettings>) => {
    setPlate((current) => ({ ...current, ...patch }));
  }, []);

  const bounds = useMemo(
    () => plateBounds(plate.lat, plate.lon, plate.sizeKm),
    [plate.lat, plate.lon, plate.sizeKm],
  );

  // Terrain for the current square: a quick low-detail plate first, then the full one.
  useEffect(() => {
    const controller = new AbortController();
    let fullArrived = false;
    queueMicrotask(() => {
      setTerrain({ status: "loading" });
      setFullDetail(false);
    });
    loadHeightGrid(bounds, PREVIEW_CELLS, controller.signal).then(
      (value) =>
        !fullArrived && !controller.signal.aborted && setTerrain({ status: "ready", value }),
      () => undefined,
    );
    loadHeightGrid(bounds, GRID_CELLS, controller.signal).then(
      (value) => {
        fullArrived = true;
        setTerrain({ status: "ready", value });
        setFullDetail(true);
      },
      () => !controller.signal.aborted && setTerrain({ status: "error" }),
    );
    return () => controller.abort();
  }, [bounds, attempt]);

  // Map, imagery or topographic map over the terrain.
  const basemap = basemapFor(plate);
  const needsDrape = plate.style === "map" || basemap !== null;
  useEffect(() => {
    if (!needsDrape) {
      queueMicrotask(() => setDrape(null));
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => setDrape({ status: "loading" }));
    (basemap
      ? loadTileDrape(bounds, basemap, controller.signal)
      : loadMapDrape(bounds, plate.theme, controller.signal)
    ).then(
      (value) => setDrape({ status: "ready", value }),
      () => {
        if (controller.signal.aborted) return;
        setDrape({ status: "error" });
        notify(t("plate.drapeError"), { tone: "error", id: "plate-drape" });
      },
    );
    return () => controller.abort();
  }, [needsDrape, basemap, plate.theme, bounds, t]);

  const deferred = useDeferredValue(plate);
  const grid = terrain.status === "ready" ? terrain.value : null;
  const autoHeight = useMemo(
    () => (grid ? autoExaggeration(grid, bounds.sizeMeters) : 1),
    [grid, bounds.sizeMeters],
  );
  // Lakes and rivers from OpenStreetMap, when asked for.
  const [waterMask, setWaterMask] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!plate.lakes) {
      queueMicrotask(() => setWaterMask(null));
      return;
    }
    const controller = new AbortController();
    loadWaterMask(bounds, controller.signal).then(
      (mask) => setWaterMask(mask),
      () => {
        if (controller.signal.aborted) return;
        setWaterMask(null);
        notify(t("plate.lakesError"), { tone: "error", id: "plate-lakes" });
      },
    );
    return () => controller.abort();
  }, [plate.lakes, bounds, t]);
  const waterReady = deferred.lakes ? waterMask : null;

  const route = useMemo(
    () => (deferred.route ? decodeRoute(deferred.route) : []),
    [deferred.route],
  );
  const raiseRoute = deferred.routeRaise && route.length > 1;
  const geometry = useMemo(
    () =>
      grid
        ? buildPlateGeometry(grid, {
            shape: deferred.shape,
            exaggeration: deferred.exaggeration || autoHeight,
            sizeMeters: bounds.sizeMeters,
            boxDepth: deferred.box,
            // A ridge 0.8 mm high on a 10 cm print.
            reliefs: [
              raiseRoute
                ? { mask: routeMask(bounds, route, grid.size), size: grid.size, height: 0.008 }
                : null,
              // Lakes and rivers sink 0.6 mm into the print.
              waterReady
                ? { mask: maskToGrid(waterReady, grid.size), size: grid.size, height: -0.006 }
                : null,
            ],
          })
        : null,
    [
      grid,
      deferred.shape,
      deferred.exaggeration,
      deferred.box,
      autoHeight,
      bounds,
      raiseRoute,
      route,
      waterReady,
    ],
  );

  // Route, markers and measuring line, drawn on the surface.
  const overlay = useMemo(
    () =>
      route.length > 1 || deferred.markers.length || measure
        ? drawOverlay(bounds, {
            route,
            markers: deferred.markers,
            color: deferred.routeColor,
            ink: deferred.ink,
            paper: deferred.paper,
            line: measure ?? undefined,
          })
        : null,
    [bounds, route, deferred.markers, deferred.routeColor, deferred.ink, deferred.paper, measure],
  );

  // Elevation profile: of the measuring line if there is one, else of the route.
  const profileLine = measure ?? (route.length > 1 ? route : null);
  const profile = useMemo(
    () => (grid && profileLine ? elevationProfile(grid, bounds, profileLine) : null),
    [grid, bounds, profileLine],
  );

  const handlePick = useCallback(
    ([u, v]: [number, number]) => {
      const [lon, lat] = plateToLonLat(bounds, u, v);
      if (picking?.kind === "marker") {
        update({
          markers: [
            ...plate.markers,
            { lat, lon, label: `${t("plate.markers.default")} ${plate.markers.length + 1}` },
          ],
        });
        setPicking(null);
        setSheet("route");
      } else if (picking?.kind === "line") {
        if (!picking.first) {
          setPicking({ kind: "line", first: [lat, lon] });
          setMeasure(null);
        } else {
          setMeasure([picking.first, [lat, lon]]);
          setPicking(null);
          setSheet("route");
        }
      }
    },
    [bounds, picking, plate.markers, update, t],
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
      palette: plate.palette,
      water: plate.water,
      strata: plate.strata,
      snow: plate.snow,
      flood: plate.flood,
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
      plate.palette,
      plate.water,
      plate.strata,
      plate.snow,
      plate.flood,
    ],
  );

  // Nameplate and summit pin. Text is drawn on a canvas, so wait for typing to pause.
  const label = useMemo(
    () => (geometry ? plateLabel(deferred, geometry.max) : null),
    [geometry, deferred],
  );
  const labelKey = label ? JSON.stringify(label) : "";
  const markerSpots = useMemo(
    () =>
      deferred.markers.map((marker) => {
        const [u, v] = toPlateUv(bounds, [marker.lat, marker.lon]);
        return { u, v, label: marker.label };
      }),
    [deferred.markers, bounds],
  );
  useEffect(() => {
    if (!geometry) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      buildPlateExtras(geometry, {
        label: labelKey ? (JSON.parse(labelKey) as typeof label) : null,
        raised: deferred.labelRelief === "raised",
        pin: deferred.pin,
        widthMm: 100,
        reliefMm: 0.8,
        cellsPerUnit: LABEL_CELLS,
        markers: markerSpots,
      }).then(
        (value) => !cancelled && setExtras(value),
        () => !cancelled && setExtras(null),
      );
    }, EXTRAS_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [geometry, labelKey, deferred.labelRelief, deferred.pin, markerSpots]);

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
    if (kind === "studio") {
      writePlateDraft(plate);
      navigate("/plate/studio");
      return;
    }
    if (kind === "card") {
      const shot = viewRef.current?.snapshot(2048);
      if (!geometry || !shot || !fullDetail) return;
      try {
        const { buildGiftCard } = await import("@/features/plate/giftCard");
        const blob = await buildGiftCard(
          shot,
          plate,
          buildPlateLink(plate),
          { scan: t("plate.card.scan"), highest: t("plate.highest") },
          geometry.max,
        );
        await triggerDownloadBlob(blob, `teetang-card-${slug(plate.name)}.png`);
        notify(t("plate.downloaded"), { tone: "success" });
      } catch {
        notify(t("plate.downloadFailed"), { tone: "error" });
      }
      return;
    }
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
        blob = await composePoster(shot, plate, caption, basemap?.credit ?? "");
      } else if (kind === "glb") {
        const input = viewRef.current?.exportScene(2048);
        if (!input) throw new Error("No scene");
        const { buildGlb } = await import("@/features/plate/glb");
        blob = await buildGlb(input);
      } else if (kind === "svg") {
        const files = await import("@/features/plate/plateFiles");
        blob = new Blob(
          [files.buildContourSvg(geometry, { ink: plate.ink, paper: plate.paper, caption })],
          { type: "image/svg+xml" },
        );
      } else {
        const model = await import("@/features/plate/printModel");
        const parts = model.modelParts(geometry, extras);
        const soups = model.printSoups(parts, 100, geometry.baseDepth);
        blob = new Blob([model.writeStl(soups)], { type: "model/stl" });
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
                overlay={overlay}
                waterMask={waterReady}
                onPick={picking ? handlePick : null}
                extras={extras}
                peakText={geometry && plate.pin ? `▲ ${highest}` : ""}
                label={geometry ? describePlate(t, title, geometry) : `${title} ${subtitle}`}
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
              {!touched && geometry && !photo && (
                <p className="plate-stage__hint">{t("plate.dragHint")}</p>
              )}
              {picking && (
                <div className="plate-pick-banner" role="status">
                  <span>
                    {picking.kind === "marker"
                      ? t("plate.pick.marker")
                      : picking.first
                        ? t("plate.pick.lineEnd")
                        : t("plate.pick.lineStart")}
                  </span>
                  <button
                    type="button"
                    className="plate-btn plate-btn--light"
                    onClick={() => {
                      setPicking(null);
                      setSheet("route");
                    }}
                  >
                    {t("plate.pick.cancel")}
                  </button>
                </div>
              )}
              {geometry && !fullDetail && terrain.status === "ready" && (
                <div className="plate-stage__pill" role="status">
                  <span className="plate-spinner" aria-hidden="true" />
                  {t("plate.addingDetail")}
                </div>
              )}
              {geometry && fullDetail && !photo && (
                <button
                  type="button"
                  className="plate-photo-btn"
                  onClick={() => {
                    tapFeedback();
                    setPhoto(viewRef.current?.exportScene(2048) ?? null);
                  }}
                >
                  <Camera size={18} aria-hidden="true" />
                  {t("plate.photo")}
                </button>
              )}
              {photo && (
                <Suspense fallback={null}>
                  <PhotoView
                    input={photo}
                    backdrop={stageBackdrop()}
                    fileName={`teetang-photo-${slug(plate.name)}.png`}
                    onClose={() => setPhoto(null)}
                  />
                </Suspense>
              )}
            </>
          )}
          <p className="plate-credit">
            Elevation: AWS Terrain Tiles
            {mode === "plate" && basemap ? ` · ${basemap.credit}` : ""}
            {mode === "plate" && (plate.style === "map" || plate.lakes)
              ? " · © OpenStreetMap contributors"
              : ""}
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
              <div
                ref={stylesRef}
                className="plate-segmented"
                role="group"
                aria-label={t("plate.styles")}
              >
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
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              onClick={() => setSheet("route")}
            >
              <Route size={20} aria-hidden="true" />
              {t("plate.route.button")}
            </button>
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              onClick={() => download("studio")}
            >
              <Box size={20} aria-hidden="true" />
              {t("plate.studio")}
            </button>
          </div>

          <div className="plate-cta">
            <button
              type="button"
              className="plate-btn plate-btn--primary"
              disabled={!geometry || !fullDetail || mode === "move"}
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
            relief={geometry ? geometry.max - geometry.min : 0}
            onChange={update}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === "route" && (
          <RouteSheet
            plate={plate}
            profile={profile}
            profileTitle={
              measure ? t("plate.profile.line") : `${title} · ${t("plate.profile.route")}`
            }
            onChange={update}
            onPick={(kind) => {
              setSheet(null);
              setPicking(kind === "marker" ? { kind } : { kind, first: null });
            }}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === "download" && (
          <DownloadSheet
            onDownload={download}
            onClose={() => setSheet(null)}
            satellite={basemap !== null}
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
  credit: string,
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
    `${plate.lat.toFixed(4)}°, ${plate.lon.toFixed(4)}° · ${plate.sizeKm} km · teetang.art${credit ? ` · ${credit}` : ""}`,
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
