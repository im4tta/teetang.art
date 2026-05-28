import type {
  MarkerIconDefinition,
  MarkerItem,
  MarkerProjectionInput,
} from "@/features/markers/domain/types";
import { projectMarkerToCanvas } from "./projection";

function serializeSvgWithColor(svgMarkup: string, color: string) {
  return svgMarkup.split("currentColor").join(color);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load marker icon."));
    image.src = src;
  });
}

function drawTintedImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const drawSize = Math.max(1, Math.round(size));
  const tintCanvas = document.createElement("canvas");
  tintCanvas.width = drawSize;
  tintCanvas.height = drawSize;
  const tintCtx = tintCanvas.getContext("2d");
  if (!tintCtx) {
    ctx.drawImage(image, x, y, size, size);
    return;
  }

  tintCtx.drawImage(image, 0, 0, drawSize, drawSize);
  tintCtx.globalCompositeOperation = "source-in";
  tintCtx.fillStyle = color;
  tintCtx.fillRect(0, 0, drawSize, drawSize);
  tintCtx.globalCompositeOperation = "source-over";

  ctx.drawImage(tintCanvas, x, y, size, size);
}

async function resolveMarkerImage(
  icon: MarkerIconDefinition,
  color: string,
): Promise<HTMLImageElement> {
  if (icon.kind === "svg" && icon.svgMarkup) {
    const encodedSvg = encodeURIComponent(serializeSvgWithColor(icon.svgMarkup, color));
    return loadImage(`data:image/svg+xml;charset=utf-8,${encodedSvg}`);
  }

  if (icon.dataUrl) {
    return loadImage(icon.dataUrl);
  }

  throw new Error(`Marker icon "${icon.id}" is missing render data.`);
}

export async function drawMarkersOnCanvas(
  ctx: CanvasRenderingContext2D,
  markers: MarkerItem[],
  icons: MarkerIconDefinition[],
  projection: MarkerProjectionInput,
  scaleX = 1,
  scaleY = 1,
  sizeScale = 1,
) {
  await Promise.all(
    markers.map(async (marker) => {
      const icon = icons.find((entry) => entry.id === marker.iconId);
      if (!icon) {
        return;
      }

      const point = projectMarkerToCanvas(marker.lat, marker.lon, projection);
      const x = point.x * scaleX;
      const y = point.y * scaleY;
      const size = marker.size * Math.max(scaleX, scaleY) * sizeScale;

      const image = await resolveMarkerImage(icon, marker.color);
      const imageSize = size;
      const imageX = x - imageSize / 2;
      const imageY = y - imageSize / 2;

      if (icon.tintWithMarkerColor) {
        drawTintedImage(ctx, image, imageX, imageY, imageSize, marker.color);
        return;
      }

      ctx.drawImage(image, imageX, imageY, imageSize, imageSize);
    }),
  );
}
