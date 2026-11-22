/**
 * Turns georeferenced elevation rasters (GeoTIFF windows from Copernicus,
 * USGS, OpenTopography…) into the plate's height grid. Plain data in, plain
 * data out, so the worker, the main-thread fallback and the tests share it.
 */
import { smoothGrid, type HeightGrid } from "./elevationCore";
import { xToLon, yToLat, type PlateBounds } from "./geo";

export interface GeoRaster {
  /** Outer edges in degrees; row 0 is the north edge, pixels are squares-by-degree. */
  west: number;
  east: number;
  north: number;
  south: number;
  width: number;
  height: number;
  /** Heights in metres, row by row from the north. */
  data: ArrayLike<number>;
  /** Value that means "no data" in `data`, besides NaN. */
  noData?: number | null;
}

/** Share of the plate's samples that fell on real data (0..1). */
export interface RasterGrid extends HeightGrid {
  coverage: number;
}

/**
 * Samples `rasters` at every grid point of the plate with bilinear
 * interpolation. Where a raster has no data the height is left at sea level,
 * and `coverage` says how much of the plate had real data. Heights below sea
 * level are flattened to 0, like the worldwide tiles.
 */
export function gridFromRasters(
  bounds: PlateBounds,
  cells: number,
  rasters: GeoRaster[],
): RasterGrid {
  const size = cells + 1;
  const heights = new Float32Array(size * size);
  const lons = new Float64Array(size);
  const lats = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    lons[i] = xToLon(bounds.x0 + ((bounds.x1 - bounds.x0) * i) / cells);
    lats[i] = yToLat(bounds.y0 + ((bounds.y1 - bounds.y0) * i) / cells);
  }

  let covered = 0;
  for (let j = 0; j < size; j++) {
    const lat = lats[j];
    for (let i = 0; i < size; i++) {
      const lon = lons[i];
      const raster = rasters.find(
        (r) => lon >= r.west && lon <= r.east && lat >= r.south && lat <= r.north,
      );
      if (!raster) continue;
      const value = sample(raster, lon, lat);
      if (value === null) continue;
      covered++;
      heights[j * size + i] = value > 0 ? value : 0;
    }
  }
  return { ...smoothGrid({ size, heights, min: 0, max: 0 }), coverage: covered / (size * size) };
}

/** Bilinear height at a position, or null where all four neighbours are empty. */
function sample(raster: GeoRaster, lon: number, lat: number): number | null {
  const { width, height, data, noData } = raster;
  const fx = ((lon - raster.west) / (raster.east - raster.west)) * width - 0.5;
  const fy = ((raster.north - lat) / (raster.north - raster.south)) * height - 0.5;
  const x0 = Math.min(width - 1, Math.max(0, Math.floor(fx)));
  const y0 = Math.min(height - 1, Math.max(0, Math.floor(fy)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = Math.min(1, Math.max(0, fx - x0));
  const ty = Math.min(1, Math.max(0, fy - y0));
  let sum = 0;
  let weight = 0;
  const add = (x: number, y: number, w: number) => {
    if (w <= 0) return;
    const value = data[y * width + x];
    if (!Number.isFinite(value) || (noData != null && value === noData)) return;
    sum += value * w;
    weight += w;
  };
  add(x0, y0, (1 - tx) * (1 - ty));
  add(x1, y0, tx * (1 - ty));
  add(x0, y1, (1 - tx) * ty);
  add(x1, y1, tx * ty);
  return weight > 0 ? sum / weight : null;
}
