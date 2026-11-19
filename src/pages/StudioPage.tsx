import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Box,
  Camera,
  CheckCircle2,
  Grid3x3,
  Layers,
  Package,
  TriangleAlert,
} from "lucide-react";
import { I18nProvider, useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import Toaster from "@/components/ui/Toaster";
import { notify } from "@/services/notify";
import { triggerDownloadBlob } from "@/services/export/fileDownloader";
import { tapFeedback } from "@/utils/haptics";
import { useWheelScrollsRows } from "@/hooks/useWheelScrollsRows";
import { plateBounds } from "@/features/plate/geo";
import { loadHeightGrid } from "@/features/plate/elevation";
import type { HeightGrid } from "@/features/plate/elevationCore";
import { autoExaggeration, buildPlateGeometry } from "@/features/plate/geometry";
import { buildPlateExtras, type PlateExtras } from "@/features/plate/extras";
import { editTerrain, modelParts, printSoups, writeStl } from "@/features/plate/printModel";
import { shapeIconPath } from "@/features/plate/shapes";
import {
  DEFAULT_PLATE,
  EXAGGERATION_LIMITS,
  LABEL_FONTS,
  LABEL_RELIEFS,
  PLATE_SHAPES,
  flagEmoji,
  parsePlateLink,
  plateLabel,
  readPlateDraft,
  writePlateDraft,
  type PlateSettings,
} from "@/features/plate/plateSettings";
import { StudioScene, type StudioView } from "@/features/studio/StudioScene";
import {
  build3mf,
  inspectParts,
  type PartReport,
  type PrintPart,
} from "@/features/studio/meshJobs";
import {
  BASE_LIMITS,
  BED_SIZES,
  COLOR_SETS,
  LAYER_HEIGHTS,
  MATERIALS,
  MAX_BANDS,
  RELIEF_LIMITS,
  RESOLUTIONS,
  WIDTH_LIMITS,
  changeHeights,
  estimateFilament,
  readPrintSettings,
  writePrintSettings,
  type PrintSettings,
} from "@/features/studio/studioSettings";
import "@/styles/plate.css";
import "@/styles/studio.css";

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ready"; value: T };

const SAVE_DELAY_MS = 400;
const CHECK_DELAY_MS = 700;
const VIEWS: StudioView[] = ["iso", "top", "front", "side"];

// The height slider is logarithmic: small steps near 1×, big ones near 30×.
const LOG_MIN = Math.log(EXAGGERATION_LIMITS.min);
const LOG_MAX = Math.log(EXAGGERATION_LIMITS.max);
const toSlider = (value: number) => ((Math.log(value) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
const fromSlider = (position: number) => {
  const value = Math.exp(LOG_MIN + (position / 100) * (LOG_MAX - LOG_MIN));
  return value < 3 ? Math.round(value * 10) / 10 : Math.round(value * 2) / 2;
};

function initialPlate(): PlateSettings {
  const fromLink = parsePlateLink(window.location.search);
  if (fromLink) {
    window.history.replaceState(window.history.state, "", "/plate/studio");
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

const mm = (value: number, digits = 1) => `${value.toFixed(digits)} mm`;

function Section({
  title,
  icon,
  children,
  open = true,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="studio-section" open={open}>
      <summary>
        {icon}
        <span>{title}</span>
      </summary>
      <div className="studio-section__body">{children}</div>
    </details>
  );
}

function Slider({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  extra,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="plate-field">
      <div className="plate-field__row">
        <label className="plate-field__label" htmlFor={id}>
          {label}
        </label>
        <output className="plate-field__value" htmlFor={id}>
          {display}
        </output>
        {extra}
      </div>
      <input
        id={id}
        type="range"
        className="plate-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function StudioApp() {
  const { t, lang, toggleLang } = useI18n();
  const [plate, setPlate] = useState<PlateSettings>(initialPlate);
  const [print, setPrint] = useState<PrintSettings>(readPrintSettings);
  const [terrain, setTerrain] = useState<Load<HeightGrid>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [extras, setExtras] = useState<PlateExtras | null>(null);
  const [reports, setReports] = useState<PartReport[] | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [section, setSection] = useState<number | null>(null);
  const [busy, setBusy] = useState<"stl" | "3mf" | "png" | null>(null);
  const [scene, setScene] = useState<StudioScene | null>(null);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWheelScrollsRows(".plate-segmented, .plate-chips");

  const updatePlate = useCallback(
    (patch: Partial<PlateSettings>) => setPlate((current) => ({ ...current, ...patch })),
    [],
  );
  const updatePrint = useCallback(
    (patch: Partial<PrintSettings>) => setPrint((current) => ({ ...current, ...patch })),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      writePlateDraft(plate);
      writePrintSettings(print);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [plate, print]);

  useEffect(() => {
    let created: StudioScene;
    try {
      created = new StudioScene(canvasRef.current!);
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    queueMicrotask(() => setScene(created));
    return () => created.dispose();
  }, []);

  const bounds = useMemo(
    () => plateBounds(plate.lat, plate.lon, plate.sizeKm),
    [plate.lat, plate.lon, plate.sizeKm],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => setTerrain({ status: "loading" }));
    loadHeightGrid(bounds, print.resolution, controller.signal).then(
      (value) => setTerrain({ status: "ready", value }),
      () => !controller.signal.aborted && setTerrain({ status: "error" }),
    );
    return () => controller.abort();
  }, [bounds, print.resolution, attempt]);

  const grid = terrain.status === "ready" ? terrain.value : null;
  const deferredPlate = useDeferredValue(plate);
  const deferredPrint = useDeferredValue(print);
  const autoHeight = useMemo(
    () => (grid ? autoExaggeration(grid, bounds.sizeMeters) : 1),
    [grid, bounds.sizeMeters],
  );
  const edited = useMemo(
    () =>
      grid
        ? editTerrain(grid, {
            smooth: deferredPrint.smooth,
            trimLow: deferredPrint.trimLow,
            trimHigh: deferredPrint.trimHigh,
          })
        : null,
    [grid, deferredPrint.smooth, deferredPrint.trimLow, deferredPrint.trimHigh],
  );
  const exaggeration = deferredPlate.exaggeration || autoHeight;
  const geometry = useMemo(
    () =>
      edited
        ? buildPlateGeometry(edited, {
            shape: deferredPlate.shape,
            exaggeration,
            sizeMeters: bounds.sizeMeters,
            boxDepth: deferredPrint.baseMm / deferredPrint.widthMm,
          })
        : null,
    [
      edited,
      deferredPlate.shape,
      exaggeration,
      bounds.sizeMeters,
      deferredPrint.baseMm,
      deferredPrint.widthMm,
    ],
  );

  const labelKey = useMemo(() => {
    const label = grid ? plateLabel(deferredPlate, grid.max, deferredPrint.widthMm) : null;
    return label ? JSON.stringify(label) : "";
  }, [grid, deferredPlate, deferredPrint.widthMm]);

  useEffect(() => {
    if (!geometry) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      buildPlateExtras(geometry, {
        label: labelKey ? JSON.parse(labelKey) : null,
        raised: deferredPlate.labelRelief === "raised",
        pin: deferredPlate.pin,
        widthMm: deferredPrint.widthMm,
        reliefMm: deferredPrint.reliefMm,
        // About 0.2 mm per cell, whatever the print size.
        cellsPerUnit: Math.min(1000, deferredPrint.widthMm / 0.2),
      }).then(
        (value) => !cancelled && setExtras(value),
        () => !cancelled && setExtras(null),
      );
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    geometry,
    labelKey,
    deferredPlate.labelRelief,
    deferredPlate.pin,
    deferredPrint.widthMm,
    deferredPrint.reliefMm,
  ]);

  // Extras follow the terrain by a moment; parts always pair the latest of each.
  const parts = useMemo(() => (geometry ? modelParts(geometry, extras) : []), [geometry, extras]);

  const widthMm = deferredPrint.widthMm;
  const lift = geometry?.baseDepth ?? 0;
  const terrainBottom = lift * widthMm;
  const terrainTop = geometry
    ? ((geometry.max - geometry.min) * geometry.verticalScale + lift) * widthMm
    : terrainBottom;
  const pinTop = extras?.pin ? (extras.pin.tip[1] + lift) * widthMm : 0;
  const modelHeight = Math.max(terrainTop, pinTop);
  const reach = extras?.reach ?? 0.5;
  const depthMm = (0.5 + Math.max(0.5, reach)) * widthMm;
  const fitsBed = widthMm <= print.bedMm && depthMm <= print.bedMm;
  const changes = useMemo(
    () => changeHeights(print, terrainBottom, terrainTop),
    [print, terrainBottom, terrainTop],
  );

  useEffect(() => {
    if (scene && geometry) scene.setModel({ parts, widthMm, lift, reach });
  }, [scene, geometry, parts, widthMm, lift, reach]);

  useEffect(() => {
    scene?.setBands(print.colors.slice(0, print.bands), changes);
  }, [scene, print.colors, print.bands, changes]);

  useEffect(() => scene?.setBed(print.bedMm), [scene, print.bedMm]);
  useEffect(() => scene?.setWireframe(wireframe), [scene, wireframe]);
  useEffect(() => scene?.setSection(section), [scene, section]);

  // Re-frame the model when it first appears and when its size changes a lot.
  const frameKey = geometry ? `${Math.round(widthMm / 20)}:${Math.round(modelHeight / 10)}` : "";
  useEffect(() => {
    if (scene && frameKey) scene.setView("iso");
  }, [scene, frameKey]);

  const printParts = useMemo<PrintPart[]>(() => {
    if (!geometry) return [];
    const colors: Record<string, string> = {
      terrain: print.colors[0],
      label: print.colors[Math.min(1, print.bands - 1)] ?? print.colors[0],
      pin: print.colors[Math.max(0, print.bands - 1)],
    };
    return printSoups(parts, widthMm, lift).map((part) => ({
      ...part,
      name: t(`studio.part.${part.id}` as TranslationKey),
      color: colors[part.id],
    }));
  }, [geometry, parts, widthMm, lift, print.colors, print.bands, t]);

  useEffect(() => {
    if (!printParts.length) return;
    let cancelled = false;
    queueMicrotask(() => !cancelled && setReports(null));
    const timer = setTimeout(() => {
      inspectParts(printParts).then(
        (value) => !cancelled && setReports(value),
        () => undefined,
      );
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [printParts]);

  const totals = reports
    ? reports.reduce(
        (sum, report) => ({
          volume: sum.volume + report.volume,
          area: sum.area + report.area,
          triangles: sum.triangles + report.triangles,
        }),
        { volume: 0, area: 0, triangles: 0 },
      )
    : null;
  const filament = totals ? estimateFilament(totals.volume, totals.area, print) : null;
  const allClosed = reports?.every((report) => report.closed) ?? false;

  const title = plate.name || t("plate.untitled");
  const subtitle = [plate.region, plate.country].filter(Boolean).join(", ");
  const fileBase = `teetang-${slug(plate.name)}-${Math.round(widthMm)}mm`;

  const exportFile = async (kind: "stl" | "3mf" | "png") => {
    if (!printParts.length || busy) return;
    setBusy(kind);
    try {
      let blob: Blob | null;
      if (kind === "stl") {
        blob = new Blob([writeStl(printParts, `teetang.art ${plate.name}`)], { type: "model/stl" });
      } else if (kind === "3mf") {
        blob = await build3mf(printParts, title);
      } else {
        blob = (await scene?.snapshot()) ?? null;
      }
      if (!blob) throw new Error("empty");
      await triggerDownloadBlob(blob, `${fileBase}.${kind}`);
      notify(t("plate.downloaded"), { tone: "success" });
    } catch {
      notify(t("plate.downloadFailed"), { tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const setCut = (index: number, value: number) => {
    const cuts = [...print.cuts];
    cuts[index] = value;
    // Keep colour changes in order from the bed up.
    for (let k = index + 1; k < cuts.length; k++) cuts[k] = Math.max(cuts[k], value);
    for (let k = index - 1; k >= 0; k--) cuts[k] = Math.min(cuts[k], value);
    updatePrint({ cuts });
  };

  const setBands = (bands: number) => {
    const cuts = Array.from({ length: MAX_BANDS - 1 }, (_, k) =>
      k < bands - 1 ? (k + 1) / bands : print.cuts[k],
    );
    updatePrint({ bands, cuts });
  };

  return (
    <div className="plate-page studio-page">
      <header className="plate-header">
        <Link to="/plate" className="plate-brand" aria-label={t("studio.back")}>
          <ArrowLeft size={22} aria-hidden="true" />
          <span>{t("plate.title")}</span>
        </Link>
        <span className="plate-header__title">{t("studio.title")}</span>
        <button
          type="button"
          className="plate-icon-btn plate-lang"
          onClick={toggleLang}
          aria-label={lang === "en" ? "Switch to Khmer" : "ប្ដូរទៅអង់គ្លេស"}
        >
          {lang === "en" ? "KH" : "EN"}
        </button>
      </header>

      <main className="studio-main">
        <section className="studio-stage" aria-busy={terrain.status === "loading"}>
          <canvas
            ref={canvasRef}
            className="studio-canvas"
            role="img"
            aria-label={`${title} ${t("studio.title")}`}
            data-ready={scene && geometry ? "true" : "false"}
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
              <button type="button" className="plate-btn" onClick={() => setAttempt((n) => n + 1)}>
                {t("plate.retry")}
              </button>
            </div>
          )}
          {failed && (
            <p className="plate-stage__message" role="alert">
              {t("plate.noWebgl")}
            </p>
          )}

          <div className="studio-toolbar" role="toolbar" aria-label={t("studio.view")}>
            {VIEWS.map((view) => (
              <button
                key={view}
                type="button"
                className="studio-tool"
                onClick={() => scene?.setView(view)}
              >
                {t(`studio.view.${view}` as TranslationKey)}
              </button>
            ))}
            <button
              type="button"
              className="studio-tool"
              aria-pressed={wireframe}
              aria-label={t("studio.wireframe")}
              title={t("studio.wireframe")}
              onClick={() => setWireframe((on) => !on)}
            >
              <Grid3x3 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="studio-tool"
              aria-label={t("studio.snapshot")}
              title={t("studio.snapshot")}
              disabled={!geometry || busy !== null}
              onClick={() => exportFile("png")}
            >
              <Camera size={18} aria-hidden="true" />
            </button>
          </div>

          {geometry && (
            <p className="studio-dims">
              {Math.round(widthMm)} × {Math.round(depthMm)} × {modelHeight.toFixed(1)} mm
              {!fitsBed && (
                <span className="studio-warn">
                  <TriangleAlert size={14} aria-hidden="true" /> {t("studio.tooBig")}
                </span>
              )}
            </p>
          )}

          <label className="studio-cut">
            <span>
              <Layers size={16} aria-hidden="true" /> {t("studio.section")}
            </span>
            <input
              type="range"
              className="plate-range"
              min={0}
              max={1}
              step={0.005}
              value={section === null ? 1 : section / Math.max(1, modelHeight)}
              onChange={(event) => {
                const value = Number(event.target.value);
                setSection(value >= 1 ? null : value * modelHeight);
              }}
            />
            <output>{section === null ? t("studio.sectionOff") : mm(section)}</output>
          </label>
        </section>

        <section className="studio-panel">
          <div className="plate-place">
            <h1
              className="plate-place__name"
              data-script={/[ក-៿]/.test(title) ? "khmer" : undefined}
            >
              {title}
            </h1>
            <p className="plate-place__meta">
              {plate.countryCode && <span aria-hidden="true">{flagEmoji(plate.countryCode)} </span>}
              {[subtitle, `${plate.sizeKm} km`].filter(Boolean).join(" · ")}
            </p>
          </div>

          <Section title={t("studio.size")} icon={<Box size={18} aria-hidden="true" />}>
            <Slider
              id="studio-width"
              label={t("studio.width")}
              value={print.widthMm}
              display={mm(print.widthMm, 0)}
              min={WIDTH_LIMITS.min}
              max={WIDTH_LIMITS.max}
              step={5}
              onChange={(widthMm) => updatePrint({ widthMm })}
            />
            <Slider
              id="studio-base"
              label={t("studio.base")}
              value={print.baseMm}
              display={mm(print.baseMm)}
              min={BASE_LIMITS.min}
              max={BASE_LIMITS.max}
              step={0.5}
              onChange={(baseMm) => updatePrint({ baseMm })}
            />
            <Slider
              id="studio-height"
              label={t("plate.adj.height")}
              value={toSlider(exaggeration)}
              display={`×${plate.exaggeration || autoHeight}`}
              min={0}
              max={100}
              step={0.5}
              onChange={(position) => updatePlate({ exaggeration: fromSlider(position) })}
              extra={
                <button
                  type="button"
                  className="plate-chip"
                  aria-pressed={plate.exaggeration === 0}
                  onClick={() => updatePlate({ exaggeration: 0 })}
                >
                  {t("plate.adj.auto")}
                </button>
              }
            />
            <fieldset className="plate-field">
              <legend className="plate-field__label">{t("studio.bed")}</legend>
              <div className="plate-chips">
                {BED_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className="plate-chip"
                    aria-pressed={print.bedMm === size}
                    onClick={() => updatePrint({ bedMm: size })}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </fieldset>
          </Section>

          <Section title={t("studio.terrain")}>
            <fieldset className="plate-field">
              <legend className="plate-field__label">{t("studio.detail")}</legend>
              <div className="plate-segmented plate-segmented--wide">
                {RESOLUTIONS.map(({ cells, id }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={print.resolution === cells}
                    onClick={() => updatePrint({ resolution: cells })}
                  >
                    {t(`studio.detail.${id}` as TranslationKey)}
                  </button>
                ))}
              </div>
            </fieldset>
            <Slider
              id="studio-smooth"
              label={t("studio.smooth")}
              value={print.smooth}
              display={String(print.smooth)}
              min={0}
              max={6}
              step={1}
              onChange={(smooth) => updatePrint({ smooth })}
            />
            <Slider
              id="studio-trim-low"
              label={t("studio.trimLow")}
              value={print.trimLow}
              display={`${Math.round(print.trimLow * 100)}%`}
              min={0}
              max={0.8}
              step={0.01}
              onChange={(trimLow) => updatePrint({ trimLow })}
            />
            <Slider
              id="studio-trim-high"
              label={t("studio.trimHigh")}
              value={print.trimHigh}
              display={`${Math.round(print.trimHigh * 100)}%`}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(trimHigh) => updatePrint({ trimHigh })}
            />
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
                      updatePlate({ shape });
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
          </Section>

          <Section title={t("plate.adj.nameplate")}>
            <label className="plate-field">
              <span className="plate-field__label">{t("plate.adj.name")}</span>
              <input
                type="text"
                className="plate-input"
                value={plate.name}
                maxLength={80}
                placeholder={t("plate.untitled")}
                onChange={(event) => updatePlate({ name: event.target.value })}
              />
            </label>
            <label className="plate-switch">
              <input
                type="checkbox"
                checked={plate.label}
                onChange={(event) => updatePlate({ label: event.target.checked })}
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
                    onChange={(event) => updatePlate({ note: event.target.value })}
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
                      onClick={() => updatePlate({ labelFont })}
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
                      onClick={() => updatePlate({ labelRelief })}
                    >
                      {t(`plate.relief.${labelRelief}` as TranslationKey)}
                    </button>
                  ))}
                </div>
                <Slider
                  id="studio-relief"
                  label={t("studio.letterDepth")}
                  value={print.reliefMm}
                  display={mm(print.reliefMm)}
                  min={RELIEF_LIMITS.min}
                  max={RELIEF_LIMITS.max}
                  step={0.1}
                  onChange={(reliefMm) => updatePrint({ reliefMm })}
                />
                <div className="plate-toggles">
                  {(["labelCoords", "labelElevation", "labelCompass", "labelScale"] as const).map(
                    (key) => (
                      <label key={key} className="plate-switch">
                        <input
                          type="checkbox"
                          checked={plate[key]}
                          onChange={(event) => updatePlate({ [key]: event.target.checked })}
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
                onChange={(event) => updatePlate({ pin: event.target.checked })}
              />
              <span>{t("plate.adj.pin")}</span>
            </label>
          </Section>

          <Section title={t("studio.colours")}>
            <p className="plate-note">{t("studio.coloursHint")}</p>
            <fieldset className="plate-field">
              <legend className="plate-field__label">{t("studio.bands")}</legend>
              <div className="plate-segmented plate-segmented--wide">
                {Array.from({ length: MAX_BANDS }, (_, k) => k + 1).map((bands) => (
                  <button
                    key={bands}
                    type="button"
                    aria-pressed={print.bands === bands}
                    onClick={() => setBands(bands)}
                  >
                    {bands}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="studio-sets" role="group" aria-label={t("studio.colourSets")}>
              {COLOR_SETS.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className="studio-set"
                  onClick={() => updatePrint({ colors: set.colors })}
                >
                  <span aria-hidden="true">
                    {set.colors.slice(0, Math.max(2, print.bands)).map((color, k) => (
                      <i key={k} style={{ background: color }} />
                    ))}
                  </span>
                  {t(`studio.set.${set.id}` as TranslationKey)}
                </button>
              ))}
            </div>
            <ol className="studio-bands">
              {Array.from({ length: print.bands }, (_, k) => (
                <li key={k} className="studio-band">
                  <label className="plate-color">
                    <input
                      type="color"
                      value={print.colors[k]}
                      onChange={(event) => {
                        const colors = [...print.colors];
                        colors[k] = event.target.value;
                        updatePrint({ colors });
                      }}
                    />
                    <span className="visually-hidden">
                      {t("studio.colour")} {k + 1}
                    </span>
                  </label>
                  {k === 0 ? (
                    <span className="studio-band__text">{t("studio.firstColour")}</span>
                  ) : (
                    <div className="studio-band__cut">
                      <span className="studio-band__text">
                        {t("studio.changeAt")} <strong>{mm(changes[k - 1] ?? 0, 2)}</strong>
                        <small>
                          {" "}
                          · {t("studio.layer")}{" "}
                          {Math.round((changes[k - 1] ?? 0) / print.layerMm) + 1}
                        </small>
                      </span>
                      <input
                        type="range"
                        className="plate-range"
                        aria-label={`${t("studio.changeAt")} ${k + 1}`}
                        min={0}
                        max={1}
                        step={0.01}
                        value={print.cuts[k - 1]}
                        onChange={(event) => setCut(k - 1, Number(event.target.value))}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <fieldset className="plate-field">
              <legend className="plate-field__label">{t("studio.layerHeight")}</legend>
              <div className="plate-chips">
                {LAYER_HEIGHTS.map((layer) => (
                  <button
                    key={layer}
                    type="button"
                    className="plate-chip"
                    aria-pressed={print.layerMm === layer}
                    onClick={() => updatePrint({ layerMm: layer })}
                  >
                    {layer} mm
                  </button>
                ))}
              </div>
            </fieldset>
          </Section>

          <Section title={t("studio.check")} icon={<Package size={18} aria-hidden="true" />}>
            <dl className="studio-stats">
              <div>
                <dt>{t("studio.dimensions")}</dt>
                <dd>
                  {Math.round(widthMm)} × {Math.round(depthMm)} × {modelHeight.toFixed(1)} mm
                </dd>
              </div>
              <div>
                <dt>{t("studio.triangles")}</dt>
                <dd>{totals ? totals.triangles.toLocaleString("en-US") : "…"}</dd>
              </div>
              <div>
                <dt>{t("studio.volume")}</dt>
                <dd>{totals ? `${totals.volume.toFixed(1)} cm³` : "…"}</dd>
              </div>
              <div>
                <dt>{t("studio.filament")}</dt>
                <dd>
                  {filament
                    ? `≈ ${Math.round(filament.grams)} g · ${filament.metres.toFixed(1)} m`
                    : "…"}
                </dd>
              </div>
            </dl>
            <div className="plate-field">
              <div
                className="plate-segmented plate-segmented--wide"
                role="group"
                aria-label={t("studio.material")}
              >
                {MATERIALS.map((material) => (
                  <button
                    key={material}
                    type="button"
                    aria-pressed={print.material === material}
                    onClick={() => updatePrint({ material })}
                  >
                    {material.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <Slider
              id="studio-infill"
              label={t("studio.infill")}
              value={print.infill}
              display={`${print.infill}%`}
              min={0}
              max={100}
              step={5}
              onChange={(infill) => updatePrint({ infill })}
            />
            <p
              className="studio-check"
              data-ok={reports ? String(allClosed) : undefined}
              role="status"
            >
              {!reports ? (
                <>
                  <span className="plate-spinner" aria-hidden="true" /> {t("studio.checking")}
                </>
              ) : allClosed ? (
                <>
                  <CheckCircle2 size={18} aria-hidden="true" /> {t("studio.closed")}
                </>
              ) : (
                <>
                  <TriangleAlert size={18} aria-hidden="true" /> {t("studio.notClosed")}
                </>
              )}
            </p>
            {!fitsBed && <p className="plate-note studio-warn-text">{t("studio.tooBigHint")}</p>}
          </Section>

          <div className="studio-export">
            <button
              type="button"
              className="plate-btn plate-btn--primary"
              disabled={!geometry || busy !== null}
              aria-busy={busy === "stl"}
              onClick={() => exportFile("stl")}
            >
              {busy === "stl" ? <span className="plate-spinner" aria-hidden="true" /> : null}
              {t("studio.downloadStl")}
            </button>
            <button
              type="button"
              className="plate-btn plate-btn--soft"
              disabled={!geometry || busy !== null}
              aria-busy={busy === "3mf"}
              onClick={() => exportFile("3mf")}
            >
              {busy === "3mf" ? <span className="plate-spinner" aria-hidden="true" /> : null}
              {t("studio.download3mf")}
            </button>
          </div>
          <p className="plate-note">{t("studio.exportHint")}</p>
        </section>
      </main>
      <Toaster />
    </div>
  );
}

export default function StudioPage() {
  return (
    <I18nProvider>
      <StudioApp />
    </I18nProvider>
  );
}
