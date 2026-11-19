import type { RgbaTile } from "./elevationCore";

/**
 * Fetches a PNG tile and returns its raw pixels. Colour management is switched
 * off: Terrarium stores heights in the RGB values, so any conversion would
 * change the terrain.
 */
export async function readRgbaTile(url: string, signal?: AbortSignal): Promise<RgbaTile | null> {
  let response: Response;
  try {
    response = await fetch(url, { signal, mode: "cors" });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    return null;
  }
  if (!response.ok) return null;
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  const { width, height } = bitmap;
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, width, height);
  return { width, height, data };
}
