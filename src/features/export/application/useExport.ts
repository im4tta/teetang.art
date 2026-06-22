import { useCallback, useMemo } from "react";
import { usePosterContext } from "@/features/poster/ui/PosterContext";
import { localStorageCache } from "@/core/cache/localStorageCache";
import type { ExportFormat } from "@/features/export/domain/types";
import { captureMapAsCanvas } from "@/features/export/infrastructure/mapExporter";
import { compositeExport, compositeDualExport } from "@/features/poster/infrastructure/renderer";
import { resolveCanvasSize } from "@/features/poster/infrastructure/renderer/canvas";
import { getAllMarkerIcons } from "@/features/markers/infrastructure/iconRegistry";
import {
  ensureGoogleFont,
  createPngBlob,
  createPdfBlobFromCanvas,
  createLayeredSvgBlobFromMap,
  createPosterFilename,
  triggerDownloadBlob,
} from "@/core/services";
import { CM_PER_INCH, DEFAULT_POSTER_WIDTH_CM, DEFAULT_POSTER_HEIGHT_CM } from "@/core/config";
import {
  getQrCodeDataUrl,
  buildGoogleMapsUrl,
  buildWhatsAppUrl,
  buildAppleMapsUrl,
  buildTelegramUrl,
  buildTeeTangUrl,
} from "@/shared/utils/qrCode";

export const SUPPORT_PROMPT_EVENT = "teetangart:support-prompt";
export type SupportPromptVariant = "first" | "milestone";
export interface SupportPromptState {
  posterNumber: number;
  variant: SupportPromptVariant;
}

const EXPORT_KEY = "teetangart.poster.count";
const EXPORT_TTL = 365 * 24 * 60 * 60 * 1000;
const readCount = () => {
  const v = localStorageCache.read<number>(EXPORT_KEY, EXPORT_TTL);
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
};
const writeCount = (n: number) => localStorageCache.write(EXPORT_KEY, n);

const SQUARE_SHAPES = new Set(["circle", "diamond", "hexagon", "star", "triangle", "heart"]);

async function buildQrUrl(form: any, lat: number, lon: number): Promise<string> {
  if (!form.showQrCode) return "";
  const data: Record<string, string | false> = {
    "google-maps": buildGoogleMapsUrl(lat, lon),
    "apple-maps": buildAppleMapsUrl(lat, lon),
    whatsapp: form.qrPhone ? buildWhatsAppUrl(form.qrPhone) : "",
    telegram: form.qrPhone ? buildTelegramUrl(form.qrPhone) : "",
    "teetang-landing": buildTeeTangUrl(lat, lon, form.displayCity),
    custom: form.qrCustomUrl || "",
  };
  const src = data[form.qrDestination] ?? buildGoogleMapsUrl(lat, lon);
  return src ? getQrCodeDataUrl(src as string, 300) : "";
}

const mediaParams = (form: any) => ({
  showQrCode: form.showQrCode,
  qrPosition: form.qrPosition,
  qrSize: form.qrSize,
  qrOpacity: form.qrOpacity,
  qrPadding: form.qrPadding,
  logoUrl: form.logoUrl,
  logoPosition: form.logoPosition,
  logoSize: form.logoSize,
  logoOpacity: form.logoOpacity,
  logoPadding: form.logoPadding,
  qrX: form.qrX,
  qrY: form.qrY,
  logoX: form.logoX,
  logoY: form.logoY,
  qrLabel: form.qrLabel,
});

export function useExport() {
  const { state, dispatch, effectiveTheme, mapRef, mapRef2 } = usePosterContext();
  const { form } = state;
  const hasVisibleMarkers = form.showMarkers && state.markers.length > 0;
  const visibleRoutes = useMemo(
    () => (form.showRoutes ? state.routes.filter((r) => r.visible) : []),
    [form.showRoutes, state.routes],
  );
  const hasVisibleOverlays = hasVisibleMarkers || visibleRoutes.length > 0;

  const registerExport = useCallback(() => {
    const n = readCount() + 1;
    writeCount(n);
    const variant: SupportPromptVariant | null =
      n === 1 ? "first" : n % 5 === 0 ? "milestone" : null;
    if (variant)
      window.dispatchEvent(
        new CustomEvent(SUPPORT_PROMPT_EVENT, { detail: { posterNumber: n, variant } }),
      );
  }, []);

  const exportPoster = useCallback(
    async (format: ExportFormat) => {
      const map = mapRef.current;
      if (!map) {
        dispatch({ type: "SET_ERROR", error: "Map is not ready." });
        return;
      }
      dispatch({ type: "SET_EXPORT_STATUS", exporting: true });
      try {
        if (form.showPosterText) {
          if (form.fontFamily.trim()) await ensureGoogleFont(form.fontFamily.trim());
          // ensureGoogleFont only loads the user-chosen display font. The
          // self-hosted Khmer fallback (Noto Sans Khmer) is loaded lazily by
          // the browser the first time text needs it, and that download can
          // still be in flight here. Waiting on document.fonts.ready makes
          // sure the canvas snapshot below uses the real Khmer glyphs/metrics
          // instead of a one-shot system fallback.
          if (typeof document !== "undefined" && document.fonts?.ready) {
            await document.fonts.ready;
          }
        }
        const isDualCity = form.layoutMode === "dual-city";
        let widthCm = Number(form.width) || DEFAULT_POSTER_WIDTH_CM;
        let heightCm = Number(form.height) || DEFAULT_POSTER_HEIGHT_CM;
        if (!isDualCity && SQUARE_SHAPES.has(form.mapShape)) {
          const s = Math.min(widthCm, heightCm);
          widthCm = heightCm = s;
        }
        const widthInches = widthCm / CM_PER_INCH,
          heightInches = heightCm / CM_PER_INCH;
        const size = resolveCanvasSize(widthInches, heightInches);
        const lat = Number(form.latitude) || 0,
          lon = Number(form.longitude) || 0;
        const qrUrl = await buildQrUrl(form, lat, lon);

        if (format === "svg" && isDualCity) {
          dispatch({
            type: "SET_ERROR",
            error: "SVG export is not yet supported for Dual City layout. Please use PNG or PDF.",
          });
          dispatch({ type: "SET_EXPORT_STATUS", exporting: false });
          return;
        }

        const markerIcons = hasVisibleOverlays ? getAllMarkerIcons(state.customMarkerIcons) : [];
        const markers = hasVisibleMarkers ? state.markers : [];
        const textParams = {
          fontFamily: form.fontFamily.trim(),
          showPosterText: form.showPosterText,
          showOverlay: form.showMarkers,
          includeCredits: form.includeCredits,
          letterSpacing: form.letterSpacing,
          showUnderline: form.showUnderline,
          coordsFormat: form.coordsFormat,
        };

        if (format === "svg") {
          const blob = await createLayeredSvgBlobFromMap({
            map,
            exportWidth: size.width,
            exportHeight: size.height,
            theme: effectiveTheme,
            center: { lat, lon },
            displayCity: form.displayCity || form.location || "",
            displayCountry: form.displayCountry || "",
            ...textParams,
            markers,
            markerIcons,
            routes: visibleRoutes,
            mapShape: form.mapShape as any,
          });
          await triggerDownloadBlob(
            blob,
            createPosterFilename(form.displayCity || form.location, form.theme, "svg"),
          );
          registerExport();
          dispatch({ type: "SET_EXPORT_STATUS", exporting: false });
          return;
        }

        let finalCanvas: HTMLCanvasElement;

        if (isDualCity) {
          const map2 = mapRef2.current;
          if (!map2) {
            dispatch({ type: "SET_ERROR", error: "Second map is not ready." });
            dispatch({ type: "SET_EXPORT_STATUS", exporting: false });
            return;
          }
          const hw = Math.round(size.width / 2);
          const [left, right] = await Promise.all([
            captureMapAsCanvas(map, hw, size.height),
            captureMapAsCanvas(map2, hw, size.height),
          ]);
          const overlayProps = hasVisibleOverlays
            ? {
                markerProjection: left.markerProjection,
                markerScaleX: left.markerScaleX,
                markerScaleY: left.markerScaleY,
                markerSizeScale: left.markerSizeScale,
              }
            : {};
          const { canvas } = await compositeDualExport(left.canvas, right.canvas, {
            theme: effectiveTheme,
            center: { lat, lon },
            widthInches,
            heightInches,
            displayCity: form.displayCity || form.location || "",
            displayCountry: form.displayCountry || "",
            displayCity2: form.displayCity2 || form.location2 || "Paris",
            displayCountry2: form.displayCountry2 || "France",
            lat2: Number(form.latitude2) || 0,
            lon2: Number(form.longitude2) || 0,
            ...textParams,
            markers,
            markerIcons,
            ...overlayProps,
            routes: visibleRoutes,
            qrUrl,
            showBorder: form.showBorder,
            ...mediaParams(form),
          });
          finalCanvas = canvas;
        } else {
          const {
            canvas: mapCanvas,
            markerProjection,
            markerScaleX,
            markerScaleY,
            markerSizeScale,
          } = await captureMapAsCanvas(map, size.width, size.height);
          const overlayProps = hasVisibleOverlays
            ? { markerProjection, markerScaleX, markerScaleY, markerSizeScale }
            : {};
          const { canvas } = await compositeExport(mapCanvas, {
            theme: effectiveTheme,
            center: { lat, lon },
            widthInches,
            heightInches,
            displayCity: form.displayCity || form.location || "",
            displayCountry: form.displayCountry || "",
            ...textParams,
            markers,
            markerIcons,
            ...overlayProps,
            routes: visibleRoutes,
            mapShape: form.mapShape as any,
            qrUrl,
            titleAlign: form.titleAlign,
            showBorder: form.showBorder,
            ...mediaParams(form),
          });
          finalCanvas = canvas;
        }

        const filename = createPosterFilename(
          form.displayCity || form.location,
          form.theme,
          format,
        );
        if (format === "pdf") {
          await triggerDownloadBlob(
            createPdfBlobFromCanvas(finalCanvas, { widthCm, heightCm }),
            filename,
          );
        } else {
          await triggerDownloadBlob(await createPngBlob(finalCanvas, 300), filename);
        }
        registerExport();
        dispatch({ type: "SET_EXPORT_STATUS", exporting: false });
      } catch (err) {
        dispatch({
          type: "SET_EXPORT_STATUS",
          exporting: false,
          error: err instanceof Error ? err.message : "Export failed.",
        });
      }
    },
    [
      mapRef,
      mapRef2,
      form,
      effectiveTheme,
      dispatch,
      hasVisibleMarkers,
      hasVisibleOverlays,
      visibleRoutes,
      registerExport,
      state.markers,
      state.customMarkerIcons,
    ],
  );

  return {
    isExporting: state.isExporting,
    exportPoster,
    handleDownloadPng: useCallback(() => exportPoster("png"), [exportPoster]),
    handleDownloadPdf: useCallback(() => exportPoster("pdf"), [exportPoster]),
    handleDownloadSvg: useCallback(() => exportPoster("svg"), [exportPoster]),
  };
}
