import { applyFades } from "./layers";
import { drawPosterText, drawDualPosterText } from "./typography";
import { drawMarkersOnCanvas } from "@/features/markers/infrastructure/rendering";
import { drawRoutesOnCanvas } from "@/features/routes/infrastructure/rendering";
import { routeEndpointMarkerItems } from "@/features/routes/infrastructure/helpers";
import type { ExportOptions, CanvasSize } from "../../domain/types";
import { applyCanvasClip } from "@/features/poster/domain/clipShapes";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Data URLs (from FileReader) are same-origin; skip crossOrigin to avoid issues
    if (!url.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function getCornerPosition(
  position: string,
  width: number,
  height: number,
  itemWidth: number,
  itemHeight: number,
  padding = 24,
  xPct?: string,
  yPct?: string,
): { x: number; y: number } {
  if (xPct !== undefined && yPct !== undefined) {
    const x = Math.round((Number(xPct) / 100) * width - itemWidth / 2);
    const y = Math.round((Number(yPct) / 100) * height - itemHeight / 2);
    return {
      x: Math.max(0, Math.min(width - itemWidth, x)),
      y: Math.max(0, Math.min(height - itemHeight, y)),
    };
  }
  switch (position) {
    case "top-left":
      return { x: padding, y: padding };
    case "top-right":
      return { x: width - itemWidth - padding, y: padding };
    case "bottom-left":
      return { x: padding, y: height - itemHeight - padding };
    case "bottom-right":
      return { x: width - itemWidth - padding, y: height - itemHeight - padding };
    case "center":
      return { x: (width - itemWidth) / 2, y: (height - itemHeight) / 2 };
    default:
      return { x: width - itemWidth - padding, y: height - itemHeight - padding };
  }
}

/**
 * Composites a final poster from a MapLibre snapshot canvas.
 *
 * 1. Draws the captured map image.
 * 2. Applies gradient fades (top + bottom).
 * 3. Draws poster text (city, country, coords, attribution).
 * 4. Draws QR code and logo if enabled.
 *
 * Returns the composited canvas + its size metadata.
 */
export async function compositeExport(
  mapCanvas: HTMLCanvasElement,
  options: ExportOptions,
): Promise<{ canvas: HTMLCanvasElement; size: CanvasSize }> {
  const {
    theme,
    center,
    widthInches: _wi,
    heightInches: _hi,
    displayCity,
    displayCountry,
    fontFamily,
    showPosterText = true,
    showOverlay = true,
    includeCredits = true,
    markers = [],
    markerIcons = [],
    markerProjection,
    markerScaleX = 1,
    markerScaleY = 1,
    markerSizeScale = 1,
    routes = [],
    mapShape = "rectangle",
    showQrCode = false,
    qrUrl = "",
    qrPosition = "bottom-right",
    qrSize = "12",
    qrOpacity = "100",
    qrPadding = "6",
    logoUrl = "",
    logoPosition = "top-right",
    logoSize = "25",
    logoOpacity = "100",
    logoPadding = "0",
    qrX,
    qrY,
    logoX,
    logoY,
    qrLabel = "",
    letterSpacing = "0",
    titleAlign = "center",
    showUnderline = true,
    coordsFormat = "decimal",
  } = options;

  const width = mapCanvas.width;
  const height = mapCanvas.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is not available.");

  // Apply clip-path for non-rectangle shapes — everything including the map
  // must be clipped so the exported poster matches the visual preview.
  ctx.save();
  applyCanvasClip(ctx, mapShape, width, height);

  // 1. Draw map snapshot
  ctx.drawImage(mapCanvas, 0, 0);

  // 2. Gradient fades
  if (showOverlay) {
    applyFades(ctx, width, height, theme.ui.bg);
  }

  // 3. Routes (below markers)
  if (routes.length > 0 && markerProjection) {
    drawRoutesOnCanvas(ctx, routes, markerProjection, markerScaleX, markerScaleY, markerSizeScale);
  }

  // 4. Route endpoint markers (between route lines and user markers)
  if (routes.length > 0 && markerIcons.length > 0 && markerProjection) {
    const endpointItems = routeEndpointMarkerItems(routes);
    if (endpointItems.length > 0) {
      await drawMarkersOnCanvas(
        ctx,
        endpointItems,
        markerIcons,
        markerProjection,
        markerScaleX,
        markerScaleY,
        markerSizeScale,
      );
    }
  }

  // 5. User markers
  if (markers.length > 0 && markerIcons.length > 0 && markerProjection) {
    await drawMarkersOnCanvas(
      ctx,
      markers,
      markerIcons,
      markerProjection,
      markerScaleX,
      markerScaleY,
      markerSizeScale,
    );
  }

  const dimScale = Math.min(width, height) / 1000;
  const khmerFallback = '"Battambang", "Suwannaphum", serif';
  const resolvedFontFamily = fontFamily
    ? `"${fontFamily}", ${khmerFallback}, sans-serif`
    : `${khmerFallback}, sans-serif`;

  // 6. Poster text
  drawPosterText(
    ctx,
    width,
    height,
    theme,
    center,
    displayCity,
    displayCountry,
    fontFamily,
    showPosterText,
    showOverlay,
    includeCredits,
    mapShape,
    letterSpacing,
    titleAlign,
    showUnderline,
    coordsFormat,
  );

  // 7. QR code
  if (showQrCode && qrUrl) {
    try {
      const qrImg = await loadImage(qrUrl);
      const qrDim = Math.round(Math.min(width, height) * (Number(qrSize) / 100));
      const pos = getCornerPosition(
        qrPosition,
        width,
        height,
        qrDim,
        qrDim,
        Number(qrPadding) * dimScale,
        qrX,
        qrY,
      );
      ctx.globalAlpha = Number(qrOpacity) / 100;
      ctx.drawImage(qrImg, pos.x, pos.y, qrDim, qrDim);
      ctx.globalAlpha = 1;
      if (qrLabel) {
        ctx.fillStyle = "#1a1a2e";
        ctx.font = `bold ${Math.max(10, Math.round(qrDim * 0.12))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(qrLabel, pos.x + qrDim / 2, pos.y + qrDim + Math.round(qrDim * 0.18));
      }
    } catch {
      // ignore QR load failures
    }
  }

  // 8. Logo
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const logoMaxW = Math.round(width * (Number(logoSize) / 100));
      const logoMaxH = Math.round(height * (Number(logoSize) / 100));
      const ratio = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1);
      const lw = Math.round(logoImg.width * ratio);
      const lh = Math.round(logoImg.height * ratio);
      const pos = getCornerPosition(
        logoPosition,
        width,
        height,
        lw,
        lh,
        Number(logoPadding) * dimScale,
        logoX,
        logoY,
      );
      ctx.globalAlpha = Number(logoOpacity) / 100;
      ctx.drawImage(logoImg, pos.x, pos.y, lw, lh);
      ctx.globalAlpha = 1;
    } catch {
      // ignore logo load failures
    }
  }

  ctx.restore();

  return {
    canvas,
    size: { width, height, requestedWidth: width, requestedHeight: height, downscaleFactor: 1 },
  };
}

export async function compositeDualExport(
  leftCanvas: HTMLCanvasElement,
  rightCanvas: HTMLCanvasElement,
  options: ExportOptions & {
    displayCity2: string;
    displayCountry2: string;
    lat2: number;
    lon2: number;
  },
): Promise<{ canvas: HTMLCanvasElement; size: CanvasSize }> {
  const {
    theme,
    center,
    widthInches: _wi,
    heightInches: _hi,
    displayCity,
    displayCountry,
    displayCity2,
    displayCountry2,
    lat2,
    lon2,
    fontFamily,
    showPosterText = true,
    showOverlay = true,
    includeCredits = true,
    markers = [],
    markerIcons = [],
    markerProjection,
    markerScaleX = 1,
    markerScaleY = 1,
    markerSizeScale = 1,
    routes = [],
    showQrCode = false,
    qrUrl = "",
    qrPosition = "bottom-right",
    qrSize = "12",
    qrOpacity = "100",
    qrPadding = "6",
    logoUrl = "",
    logoPosition = "top-right",
    logoSize = "25",
    logoOpacity = "100",
    logoPadding = "0",
    qrX,
    qrY,
    logoX,
    logoY,
    qrLabel = "",
    letterSpacing = "0",
    showUnderline = true,
    coordsFormat = "decimal",
    showBorder = true,
  } = options;

  const width = leftCanvas.width + rightCanvas.width;
  const height = leftCanvas.height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering is not available.");

  // 1. Draw left map
  ctx.drawImage(leftCanvas, 0, 0);

  // 2. Draw right map
  ctx.drawImage(rightCanvas, leftCanvas.width, 0);

  // 3. Center divider line (match preview .dual-map-half--left border-right)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftCanvas.width, 0);
  ctx.lineTo(leftCanvas.width, height);
  ctx.stroke();

  // 4. Gradient fades (over entire canvas)
  if (showOverlay) {
    applyFades(ctx, width, height, theme.ui.bg);
  }

  // 5. Routes and markers (only on primary/left map for simplicity)
  if (routes.length > 0 && markerProjection) {
    drawRoutesOnCanvas(ctx, routes, markerProjection, markerScaleX, markerScaleY, markerSizeScale);
  }
  if (routes.length > 0 && markerIcons.length > 0 && markerProjection) {
    const endpointItems = routeEndpointMarkerItems(routes);
    if (endpointItems.length > 0) {
      await drawMarkersOnCanvas(
        ctx,
        endpointItems,
        markerIcons,
        markerProjection,
        markerScaleX,
        markerScaleY,
        markerSizeScale,
      );
    }
  }
  if (markers.length > 0 && markerIcons.length > 0 && markerProjection) {
    await drawMarkersOnCanvas(
      ctx,
      markers,
      markerIcons,
      markerProjection,
      markerScaleX,
      markerScaleY,
      markerSizeScale,
    );
  }

  const dimScale = Math.min(width, height) / 1000;

  // 6. Dual poster text
  drawDualPosterText(
    ctx,
    width,
    height,
    theme,
    { city: displayCity, country: displayCountry, center },
    { city: displayCity2, country: displayCountry2, center: { lat: lat2, lon: lon2 } },
    fontFamily,
    showPosterText,
    showOverlay,
    includeCredits,
    letterSpacing,
    coordsFormat,
    showUnderline,
  );

  // 7. QR code
  if (showQrCode && qrUrl) {
    try {
      const qrImg = await loadImage(qrUrl);
      const qrDim = Math.round(Math.min(width, height) * (Number(qrSize) / 100));
      const pos = getCornerPosition(
        qrPosition,
        width,
        height,
        qrDim,
        qrDim,
        Number(qrPadding) * dimScale,
        qrX,
        qrY,
      );
      ctx.globalAlpha = Number(qrOpacity) / 100;
      ctx.drawImage(qrImg, pos.x, pos.y, qrDim, qrDim);
      ctx.globalAlpha = 1;
      if (qrLabel) {
        ctx.fillStyle = "#1a1a2e";
        ctx.font = `bold ${Math.max(10, Math.round(qrDim * 0.12))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(qrLabel, pos.x + qrDim / 2, pos.y + qrDim + Math.round(qrDim * 0.18));
      }
    } catch {
      // ignore QR load failures
    }
  }

  // 8. Logo
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const logoMaxW = Math.round(width * (Number(logoSize) / 100));
      const logoMaxH = Math.round(height * (Number(logoSize) / 100));
      const ratio = Math.min(logoMaxW / logoImg.width, logoMaxH / logoImg.height, 1);
      const lw = Math.round(logoImg.width * ratio);
      const lh = Math.round(logoImg.height * ratio);
      const pos = getCornerPosition(
        logoPosition,
        width,
        height,
        lw,
        lh,
        Number(logoPadding) * dimScale,
        logoX,
        logoY,
      );
      ctx.globalAlpha = Number(logoOpacity) / 100;
      ctx.drawImage(logoImg, pos.x, pos.y, lw, lh);
      ctx.globalAlpha = 1;
    } catch {
      // ignore logo load failures
    }
  }

  // 9. Outer border (match preview .poster-border: inset 10px, 1px solid rgba(255,255,255,0.1))
  if (showBorder) {
    const inset = Math.max(10, Math.round(Math.min(width, height) * 0.01));
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  }

  return {
    canvas,
    size: { width, height, requestedWidth: width, requestedHeight: height, downscaleFactor: 1 },
  };
}

export { resolveCanvasSize } from "./canvas";
export { applyFades } from "./layers";
export { drawPosterText } from "./typography";
