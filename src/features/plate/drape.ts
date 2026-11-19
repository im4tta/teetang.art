/**
 * Images laid over the terrain: one of our poster themes, or a raster map
 * (imagery, topographic or relief). Both cover exactly the plate's square, so
 * texture coordinates line up.
 */
import { tileUrlFor, type Basemap } from "./basemaps";
import { coveringTiles, tileZoomFor, wrapTileX, type PlateBounds } from "./geo";

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

export async function loadTileDrape(
  bounds: PlateBounds,
  map: Basemap,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const size = drapeSize();
  const zoom = tileZoomFor(bounds, size, map.maxZoom);
  const tiles = coveringTiles(bounds, zoom);
  const images = await Promise.all(
    tiles.map(([x, y]) => loadTile(tileUrlFor(map, zoom, wrapTileX(x, zoom), y), signal)),
  );
  if (images.every((image) => image === null)) {
    throw new Error(`${map.name} is not available right now.`);
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

const WATER_SOURCE = "https://tiles.openfreemap.org/planet";

/**
 * Lakes, reservoirs, wide rivers and river lines from OpenStreetMap (through
 * OpenFreeMap's vector tiles), white on black over the plate's square.
 * Streams are only drawn on small plates, where they are wide enough to see.
 */
export async function loadWaterMask(
  bounds: PlateBounds,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const [{ default: maplibregl }, exportUtils] = await Promise.all([
    import("maplibre-gl"),
    import("@/services/export/exportUtils"),
  ]);
  signal?.throwIfAborted();
  const size = 1024;
  const lineClasses = bounds.sizeMeters <= 5000 ? ["river", "canal", "stream"] : ["river", "canal"];
  const container = exportUtils.createOffscreenContainer(size, size);
  document.body.appendChild(container);
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: { osm: { type: "vector", url: WATER_SOURCE } },
      layers: [
        { id: "land", type: "background", paint: { "background-color": "#000000" } },
        {
          id: "water",
          type: "fill",
          source: "osm",
          "source-layer": "water",
          paint: { "fill-color": "#ffffff", "fill-antialias": true },
        },
        {
          id: "waterway",
          type: "line",
          source: "osm",
          "source-layer": "waterway",
          filter: ["in", ["get", "class"], ["literal", lineClasses]],
          // About 0.4% of the plate's width: visible, and deep enough to print.
          paint: { "line-color": "#ffffff", "line-width": size * 0.004 },
          layout: { "line-cap": "round", "line-join": "round" },
        },
      ],
    },
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

/** A mask canvas resampled to a grid of `size × size` values in 0..1 (red channel). */
export function maskToGrid(canvas: HTMLCanvasElement, size: number): Float32Array {
  const small = squareCanvas(size);
  const ctx = small.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const out = new Float32Array(size * size);
  for (let k = 0; k < out.length; k++) out[k] = data[k * 4] / 255;
  return out;
}
