/**
 * Images laid over the terrain: one of our poster themes, or satellite imagery.
 * Both cover exactly the plate's square, so texture coordinates line up.
 */
import { coveringTiles, tileZoomFor, wrapTileX, type PlateBounds } from "./geo";

/** Sentinel-2 cloudless by EOX — CC BY-NC-SA 4.0, non-commercial use only. */
const SATELLITE_URL =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg";
export const SATELLITE_CREDIT =
  "Sentinel-2 cloudless (s2maps.eu) by EOX IT Services GmbH · modified Copernicus Sentinel data 2020";
// Sentinel-2 pixels are 10 m; zoom 14 already matches them, so higher zooms only add downloads.
const SATELLITE_MAX_ZOOM = 14;
const TILE = 256;

const drapeSize = () => (window.innerWidth >= 900 ? 2048 : 1024);

function squareCanvas(size: number) {
  return Object.assign(document.createElement("canvas"), { width: size, height: size });
}

async function loadTile(url: string, signal?: AbortSignal): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(url, { signal, mode: "cors" });
    return response.ok ? await createImageBitmap(await response.blob()) : null;
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    return null;
  }
}

export async function loadSatelliteDrape(
  bounds: PlateBounds,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const size = drapeSize();
  const zoom = tileZoomFor(bounds, size, SATELLITE_MAX_ZOOM);
  const tiles = coveringTiles(bounds, zoom);
  const images = await Promise.all(
    tiles.map(([x, y]) =>
      loadTile(
        SATELLITE_URL.replace("{z}", String(zoom))
          .replace("{x}", String(wrapTileX(x, zoom)))
          .replace("{y}", String(y)),
        signal,
      ),
    ),
  );
  if (images.every((image) => image === null)) {
    throw new Error("Satellite imagery is not available right now.");
  }
  const canvas = squareCanvas(size);
  const ctx = canvas.getContext("2d")!;
  const world = 2 ** zoom * TILE;
  const scale = size / ((bounds.x1 - bounds.x0) * world);
  tiles.forEach(([x, y], index) => {
    const image = images[index];
    if (!image) return;
    const left = (x * TILE - bounds.x0 * world) * scale;
    const top = (y * TILE - bounds.y0 * world) * scale;
    // Half a pixel of overlap hides seams between tiles.
    ctx.drawImage(image, left, top, TILE * scale + 0.5, TILE * scale + 0.5);
    image.close();
  });
  return canvas;
}

export async function loadMapDrape(
  bounds: PlateBounds,
  themeId: string,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const [{ default: maplibregl }, { generateMapStyle }, { getTheme }, exportUtils] =
    await Promise.all([
      import("maplibre-gl"),
      import("@/services/map/maplibreStyle"),
      import("@/services/theme/themeRepository"),
      import("@/services/export/exportUtils"),
    ]);
  signal?.throwIfAborted();
  const size = drapeSize();
  const container = exportUtils.createOffscreenContainer(size, size);
  document.body.appendChild(container);
  const map = new maplibregl.Map({
    container,
    style: generateMapStyle(getTheme(themeId), { distanceMeters: bounds.sizeMeters / 2 }),
    bounds: [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    fitBoundsOptions: { padding: 0 },
    interactive: false,
    attributionControl: false,
    pixelRatio: 1,
    fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  try {
    await exportUtils.waitForMapIdle(map);
    signal?.throwIfAborted();
    const canvas = squareCanvas(size);
    canvas.getContext("2d")!.drawImage(map.getCanvas(), 0, 0, size, size);
    return canvas;
  } finally {
    map.remove();
    container.remove();
  }
}
