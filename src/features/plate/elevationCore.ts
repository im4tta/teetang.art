/**
 * Turns Terrarium elevation tiles into a regular height grid. Shared by the
 * worker and the main-thread fallback, so it only touches plain data.
 */
import { coveringTiles, tileZoomFor, wrapTileX, type PlateBounds } from "./geo";

/** AWS Terrain Tiles: free, keyless, worldwide (SRTM, GMTED, ETOPO and more). */
export const ELEVATION_TILE_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const ELEVATION_MAX_ZOOM = 15;
const TILE = 256;

/** Where a grid's heights came from, for the credit line and the Adjust sheet. */
export interface ElevationMeta {
  /** The data source the plate asked for ("" is the worldwide default). */
  requested: string;
  /** The data source that actually supplied the heights. */
  used: string;
  /** Plain-language name of the dataset(s) behind the heights. */
  label: string;
  /** Roughly how far apart the height samples are on the ground, in metres. */
  resolutionM?: number;
  /** Set when the requested source failed and the worldwide data stepped in. */
  fellBack?: string;
}

export interface HeightGrid {
  /** Samples per side; the grid holds `size * size` heights in metres, row by row from the north. */
  size: number;
  heights: Float32Array;
  min: number;
  max: number;
  meta?: ElevationMeta;
}

export interface RgbaTile {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** The tile's `x-amz-meta-x-imagery-sources` header: the files it was built from. */
  sources?: string;
}

export type TileReader = (url: string, signal?: AbortSignal) => Promise<RgbaTile | null>;

export const tileUrl = (z: number, x: number, y: number) =>
  ELEVATION_TILE_URL.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));

export async function buildHeightGrid(
  bounds: PlateBounds,
  cells: number,
  readTile: TileReader,
  signal?: AbortSignal,
): Promise<HeightGrid> {
  const zoom = tileZoomFor(bounds, cells, ELEVATION_MAX_ZOOM);
  const tiles = coveringTiles(bounds, zoom);
  const tx0 = Math.min(...tiles.map(([x]) => x));
  const ty0 = Math.min(...tiles.map(([, y]) => y));
  const cols = Math.max(...tiles.map(([x]) => x)) - tx0 + 1;
  const rows = Math.max(...tiles.map(([, y]) => y)) - ty0 + 1;
  const width = cols * TILE;
  const mosaic = new Float32Array(width * rows * TILE);

  const decoded = await Promise.all(
    tiles.map(([x, y]) => readTile(tileUrl(zoom, wrapTileX(x, zoom), y), signal)),
  );
  if (decoded.every((tile) => tile === null)) {
    throw new Error("Elevation data is not available right now.");
  }

  tiles.forEach(([x, y], index) => {
    const tile = decoded[index];
    if (!tile || tile.width !== TILE || tile.height !== TILE) return;
    const ox = (x - tx0) * TILE;
    const oy = (y - ty0) * TILE;
    const { data } = tile;
    for (let py = 0; py < TILE; py++) {
      let target = (oy + py) * width + ox;
      let source = py * TILE * 4;
      for (let px = 0; px < TILE; px++, target++, source += 4) {
        // Terrarium encoding; the sea floor is flattened to sea level.
        const metres = data[source] * 256 + data[source + 1] + data[source + 2] / 256 - 32768;
        mosaic[target] = metres > 0 ? metres : 0;
      }
    }
  });

  const scale = 2 ** zoom * TILE;
  const originX = tx0 * TILE;
  const originY = ty0 * TILE;
  const maxX = width - 1;
  const maxY = rows * TILE - 1;
  const size = cells + 1;
  const heights = new Float32Array(size * size);

  for (let j = 0; j < size; j++) {
    const my = bounds.y0 + ((bounds.y1 - bounds.y0) * j) / cells;
    const fy = Math.min(maxY, Math.max(0, my * scale - originY - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(maxY, y0 + 1);
    const ty = fy - y0;
    for (let i = 0; i < size; i++) {
      const mx = bounds.x0 + ((bounds.x1 - bounds.x0) * i) / cells;
      const fx = Math.min(maxX, Math.max(0, mx * scale - originX - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(maxX, x0 + 1);
      const tx = fx - x0;
      const top = mosaic[y0 * width + x0] * (1 - tx) + mosaic[y0 * width + x1] * tx;
      const bottom = mosaic[y1 * width + x0] * (1 - tx) + mosaic[y1 * width + x1] * tx;
      heights[j * size + i] = top * (1 - ty) + bottom * ty;
    }
  }

  const grid = smoothGrid({ size, heights, min: 0, max: 0 });
  const described = describeTerrariumSources(
    decoded.flatMap((tile) => (tile?.sources ? tile.sources.split(",") : [])),
  );
  return {
    ...grid,
    meta: { requested: "", used: "", label: described.label, resolutionM: described.resolutionM },
  };
}

/**
 * Terrarium tiles are a patchwork of national and global models, and say which
 * in a header. The first match in this list names the file's dataset.
 */
const DATASETS: { match: RegExp; label: string; resolutionM: number }[] = [
  { match: /^uk_lidar/, label: "England lidar (Environment Agency)", resolutionM: 2 },
  { match: /^ned19|^ned_topo/, label: "USGS lidar 3DEP", resolutionM: 3 },
  { match: /^ned13/, label: "USGS 3DEP 1/3″", resolutionM: 10 },
  { match: /^ned/, label: "USGS 3DEP", resolutionM: 10 },
  { match: /^nrcan|^cdem|^ca_/, label: "Natural Resources Canada CDEM", resolutionM: 20 },
  { match: /^eudem/, label: "EU-DEM (Copernicus)", resolutionM: 25 },
  { match: /^srtm/, label: "SRTM (NASA)", resolutionM: 30 },
  { match: /^arctic/, label: "ArcticDEM", resolutionM: 10 },
  { match: /^gmted/, label: "GMTED2010 (USGS)", resolutionM: 250 },
  { match: /^etopo/, label: "ETOPO1 (NOAA)", resolutionM: 1800 },
];

export function describeTerrariumSources(files: string[]): { label: string; resolutionM?: number } {
  const found = new Map<string, number>();
  for (const file of files) {
    const name = file.trim().split("/")[0];
    if (!name) continue;
    const dataset = DATASETS.find((d) => d.match.test(name));
    if (dataset) found.set(dataset.label, dataset.resolutionM);
    else found.set(name, NaN);
  }
  if (!found.size) return { label: "AWS Terrain Tiles" };
  // Coarse backups (GMTED, ETOPO) only fill gaps; show them only when nothing finer is there.
  const entries = [...found.entries()].sort((a, b) => (a[1] || 1e9) - (b[1] || 1e9));
  const fine = entries.filter(([, res]) => !(res >= 250));
  const used = fine.length ? fine : entries;
  const resolution = used.map(([, res]) => res).find((res) => Number.isFinite(res));
  return { label: used.map(([label]) => label).join(" + "), resolutionM: resolution };
}

/**
 * One pass of a 3×3 blur. Elevation models carry a little noise from radar
 * speckle; without this, contour lines come out ragged.
 */
export function smoothGrid(grid: HeightGrid): HeightGrid {
  const { size, heights } = grid;
  const out = new Float32Array(heights.length);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let sum = 0;
      let weight = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const y = j + dj;
        if (y < 0 || y >= size) continue;
        for (let di = -1; di <= 1; di++) {
          const x = i + di;
          if (x < 0 || x >= size) continue;
          const w = di === 0 && dj === 0 ? 4 : di === 0 || dj === 0 ? 2 : 1;
          sum += heights[y * size + x] * w;
          weight += w;
        }
      }
      const h = sum / weight;
      out[j * size + i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { size, heights: out, min, max, meta: grid.meta };
}
