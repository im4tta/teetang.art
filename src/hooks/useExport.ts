import { useCallback, useMemo } from "react";
import { usePosterContext } from "@/context/PosterContext";
import { localStorageCache } from "@/services/cache/localStorageCache";
import type { ExportFormat } from "@/services/export/types";
import { captureMapAsCanvas } from "@/services/export/mapExporter";
import { compositeExport, compositeDualExport } from "@/services/poster/renderer";
import { resolveCanvasSize } from "@/services/poster/renderer/canvas";
import { getAllMarkerIcons } from "@/services/markers/iconRegistry";
import {
  ensureGoogleFont,
  createPngBlob,
  createPdfBlobFromCanvas,
  createLayeredSvgBlobFromMap,
  createPosterFilename,
  triggerDownloadBlob,
} from "@/services/container";
import { CM_PER_INCH, DEFAULT_POSTER_WIDTH_CM, DEFAULT_POSTER_HEIGHT_CM } from "@/services/config";
import { getQrCodeDataUrl } from "@/utils/qrCode";
import { resolveQrTarget } from "@/services/share/posterLink";
import type { PosterForm } from "@/context/posterReducer";

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

async function buildQrUrl(form: PosterForm): Promise<string> {
  const target = form.showQrCode ? resolveQrTarget(form) : "";
  return target ? getQrCodeDataUrl(target, 300) : "";
}

const mediaParams = (form: PosterForm) => ({
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

  /** Renders the poster in `format`; throws with a user-facing message on failure. */
  const renderPoster = useCallback(
    async (format: ExportFormat): Promise<{ blob: Blob; filename: string }> => {
      const map = mapRef.current;
      if (!map) throw new Error("Map is not ready.");
      if (form.showPosterText && form.fontFamily.trim()) {
        await ensureGoogleFont(form.fontFamily.trim());
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
      const qrUrl = await buildQrUrl(form);

      if (format === "svg" && isDualCity) {
        throw new Error(
          "SVG export is not yet supported for Dual City layout. Please use PNG or PDF.",
        );
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
        return {
          blob,
          filename: createPosterFilename(form.displayCity || form.location, form.theme, "svg"),
        };
      }

      let finalCanvas: HTMLCanvasElement;

      if (isDualCity) {
        const map2 = mapRef2.current;
        if (!map2) throw new Error("Second map is not ready.");
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

      const filename = createPosterFilename(form.displayCity || form.location, form.theme, format);
      const blob =
        format === "pdf"
          ? createPdfBlobFromCanvas(finalCanvas, { widthCm, heightCm })
          : await createPngBlob(finalCanvas, 300);
      return { blob, filename };
    },
    [
      mapRef,
      mapRef2,
      form,
      effectiveTheme,
      hasVisibleMarkers,
      hasVisibleOverlays,
      visibleRoutes,
      state.markers,
      state.customMarkerIcons,
    ],
  );

  const exportPoster = useCallback(
    async (format: ExportFormat) => {
      dispatch({ type: "SET_EXPORT_STATUS", exporting: true });
      try {
        const { blob, filename } = await renderPoster(format);
        await triggerDownloadBlob(blob, filename);
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
    [dispatch, renderPoster, registerExport],
  );

  /** Renders the poster as a PNG file for the native share sheet. */
  const renderPosterFile = useCallback(async (): Promise<File | null> => {
    dispatch({ type: "SET_EXPORT_STATUS", exporting: true });
    try {
      const { blob, filename } = await renderPoster("png");
      registerExport();
      dispatch({ type: "SET_EXPORT_STATUS", exporting: false });
      return new File([blob], filename, { type: blob.type || "image/png" });
    } catch (err) {
      dispatch({
        type: "SET_EXPORT_STATUS",
        exporting: false,
        error: err instanceof Error ? err.message : "Export failed.",
      });
      return null;
    }
  }, [dispatch, renderPoster, registerExport]);

  return {
    isExporting: state.isExporting,
    exportPoster,
    renderPosterFile,
  };
}
