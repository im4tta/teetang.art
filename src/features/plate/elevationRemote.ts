/**
 * Elevation from GeoTIFF sources: Copernicus GLO-30 (cloud-optimised files,
 * read through our own /api/dem proxy because the bucket sends no CORS
 * headers), USGS 3DEP (image server) and OpenTopography (the visitor's key).
 *
 * Every loader returns plain rasters and throws on anything unexpected; the
 * caller falls back to the worldwide tiles. geotiff.js loads on first use, so
 * the default path never pays for it.
 */
import type { GeoRaster } from "./rasterGrid";
import type { PlateBounds } from "./geo";
import { isOpenTopoKey, openTopoDataset } from "./elevationSources";

export class SourceError extends Error {
  constructor(
    readonly reason: "failed" | "coverage" | "size" | "key",
    message?: string,
  ) {
    super(message ?? reason);
  }
}

const loadGeoTiff = () => import("geotiff");

/** Raster values far below any real ground are a server's "no data" fill. */
const FILL_BELOW = -1000;

const abortIfNeeded = (signal?: AbortSignal) => signal?.throwIfAborted();

// ── Copernicus GLO-30 ────────────────────────────────────────────────────

/** Path on our own origin that forwards ranges to the public Copernicus bucket. */
export const COPERNICUS_PROXY = "/api/dem";

/** Tile names use the south-west corner: N12E104 covers 12–13°N, 104–105°E. */
export function copernicusTileName(lat: number, lon: number): string {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  const ns = lat >= 0 ? "N" : "S";
  const ew = wrapped >= 0 ? "E" : "W";
  return `${ns}${String(Math.abs(lat)).padStart(2, "0")}${ew}${String(Math.abs(wrapped)).padStart(3, "0")}`;
}

export async function loadCopernicus(
  bounds: PlateBounds,
  cells: number,
  signal?: AbortSignal,
): Promise<GeoRaster[]> {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = Math.floor(bounds.south); lat <= Math.floor(bounds.north); lat++) lats.push(lat);
  for (let lon = Math.floor(bounds.west); lon <= Math.floor(bounds.east); lon++) lons.push(lon);
  if (lats.length * lons.length > 6) throw new SourceError("size");

  const found = await Promise.all(
    lats.flatMap((lat) => lons.map((lon) => copernicusTile(lat, lon, bounds, cells, signal))),
  );
  const rasters = found.filter((raster): raster is GeoRaster => raster !== null);
  // Every tile missing means open sea; a plate with no land has nothing to build.
  if (!rasters.length) throw new SourceError("coverage");
  return rasters;
}

async function copernicusTile(
  lat: number,
  lon: number,
  bounds: PlateBounds,
  cells: number,
  signal?: AbortSignal,
): Promise<GeoRaster | null> {
  const url = `${COPERNICUS_PROXY}?tile=${copernicusTileName(lat, lon)}`;

  // One byte tells a tile that is not there (open sea) from a proxy that is not.
  let probe: Response;
  try {
    probe = await fetch(url, { headers: { Range: "bytes=0-0" }, signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new SourceError("failed", "network");
  }
  if (probe.status === 404 && probe.headers.get("x-dem") === "missing") return null;
  if (probe.status !== 206) throw new SourceError("failed", `proxy-${probe.status}`);

  const { fromUrl } = await loadGeoTiff();
  const tiff = await fromUrl(url, { allowFullFile: false }, signal);
  const count = await tiff.getImageCount();

  // The plate's share of this tile, in degrees.
  const spanLon = Math.max(1e-6, bounds.east - bounds.west);
  const wanted = cells / spanLon; // pixels per degree the grid can use
  let pick = 0;
  let width = 0;
  let height = 0;
  for (let i = 0; i < count; i++) {
    const image = await tiff.getImage(i);
    if (i === 0 || image.getWidth() >= wanted) {
      pick = i;
      width = image.getWidth();
      height = image.getHeight();
    }
  }
  const image = await tiff.getImage(pick);

  const west = Math.max(bounds.west, lon) - lon;
  const east = Math.min(bounds.east, lon + 1) - lon;
  const south = Math.max(bounds.south, lat) - lat;
  const north = Math.min(bounds.north, lat + 1) - lat;
  if (east <= west || north <= south) return null;
  const x0 = Math.max(0, Math.floor(west * width) - 2);
  const x1 = Math.min(width, Math.ceil(east * width) + 2);
  const y0 = Math.max(0, Math.floor((1 - north) * height) - 2);
  const y1 = Math.min(height, Math.ceil((1 - south) * height) + 2);

  abortIfNeeded(signal);
  const [data] = (await image.readRasters({
    window: [x0, y0, x1, y1],
    samples: [0],
    signal,
  })) as unknown as [ArrayLike<number>];
  return {
    west: lon + x0 / width,
    east: lon + x1 / width,
    north: lat + 1 - y0 / height,
    south: lat + 1 - y1 / height,
    width: x1 - x0,
    height: y1 - y0,
    data,
  };
}

// ── USGS 3DEP ────────────────────────────────────────────────────────────

const THREEDEP_URL =
  "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage";

export async function load3dep(
  bounds: PlateBounds,
  cells: number,
  signal?: AbortSignal,
): Promise<GeoRaster[]> {
  const size = Math.min(2000, cells + 1);
  const params = new URLSearchParams({
    bbox: [bounds.west, bounds.south, bounds.east, bounds.north].map((n) => n.toFixed(6)).join(","),
    bboxSR: "4326",
    imageSR: "4326",
    size: `${size},${size}`,
    format: "tiff",
    pixelType: "F32",
    interpolation: "RSP_BilinearInterpolation",
    f: "image",
  });
  const raster = await fetchTiff(`${THREEDEP_URL}?${params}`, signal);
  const image = raster.image;
  const [data] = (await image.readRasters({ samples: [0], signal })) as unknown as [
    ArrayLike<number>,
  ];
  const clean = Float32Array.from(data, (value) => (value < FILL_BELOW ? NaN : value));
  return [
    {
      west: bounds.west,
      east: bounds.east,
      north: bounds.north,
      south: bounds.south,
      width: image.getWidth(),
      height: image.getHeight(),
      data: clean,
    },
  ];
}

// ── OpenTopography ───────────────────────────────────────────────────────

const OPENTOPO_URL = "https://portal.opentopography.org/API/globaldem";

export async function loadOpenTopography(
  bounds: PlateBounds,
  sourceId: string,
  key: string | undefined,
  signal?: AbortSignal,
): Promise<GeoRaster[]> {
  const dataset = openTopoDataset(sourceId);
  if (!dataset || !/^[A-Za-z0-9]+$/.test(dataset)) throw new SourceError("failed", "dataset");
  if (!isOpenTopoKey(key)) throw new SourceError("key");
  const pad = 0.01;
  const params = new URLSearchParams({
    demtype: dataset,
    south: (bounds.south - pad).toFixed(5),
    north: (bounds.north + pad).toFixed(5),
    west: (bounds.west - pad).toFixed(5),
    east: (bounds.east + pad).toFixed(5),
    outputFormat: "GTiff",
    API_Key: key,
  });
  const { image } = await fetchTiff(`${OPENTOPO_URL}?${params}`, signal);
  const [west, south, east, north] = image.getBoundingBox();
  const noData = image.getGDALNoData();
  const [data] = (await image.readRasters({ samples: [0], signal })) as unknown as [
    ArrayLike<number>,
  ];
  return [
    {
      west,
      east,
      north,
      south,
      width: image.getWidth(),
      height: image.getHeight(),
      data,
      noData,
    },
  ];
}

// ── Shared ───────────────────────────────────────────────────────────────

/** Downloads a GeoTIFF; JSON or HTML answers (an error page, a bad key) are failures. */
async function fetchTiff(url: string, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(url, { signal, mode: "cors" });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new SourceError("failed", "network");
  }
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || /json|html|text\/plain/i.test(type)) {
    throw new SourceError(
      response.status === 401 || response.status === 403 ? "key" : "failed",
      `http-${response.status}`,
    );
  }
  const { fromArrayBuffer } = await loadGeoTiff();
  const tiff = await fromArrayBuffer(await response.arrayBuffer(), signal);
  return { image: await tiff.getImage() };
}
