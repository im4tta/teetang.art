/**
 * How steep the ground is. Slope comes from the height grid by central
 * differences, in degrees from level, so it does not depend on the plate's
 * height exaggeration.
 */
import type { HeightGrid } from "./elevationCore";

/** Upper edges of the slope bands, in degrees: gentle, moderate, steep, very steep, extreme. */
export const SLOPE_BANDS = [5, 15, 30, 45] as const;

export interface SlopeMap {
  /** Band per cell, 0 (under 5°) to 4 (45° or more); `size × size`, row 0 north. */
  bands: Uint8Array;
  size: number;
  /** Steepest slope on the plate, in degrees. */
  maxDegrees: number;
  /** Share of the plate at 30° or steeper, 0..1. */
  steepShare: number;
}

export function computeSlope(grid: HeightGrid, widthM: number): SlopeMap {
  const { size, heights } = grid;
  const last = size - 1;
  const cellM = widthM / last;
  const bands = new Uint8Array(size * size);
  let maxDegrees = 0;
  let steep = 0;
  const at = (i: number, j: number) =>
    heights[Math.min(last, Math.max(0, j)) * size + Math.min(last, Math.max(0, i))];
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      // Edges use one-sided steps, so the span there is one cell, not two.
      const spanX = (i > 0 && i < last ? 2 : 1) * cellM;
      const spanY = (j > 0 && j < last ? 2 : 1) * cellM;
      const dzdx = (at(i + 1, j) - at(i - 1, j)) / spanX;
      const dzdy = (at(i, j + 1) - at(i, j - 1)) / spanY;
      const degrees = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      maxDegrees = Math.max(maxDegrees, degrees);
      let band = 0;
      while (band < SLOPE_BANDS.length && degrees >= SLOPE_BANDS[band]) band++;
      bands[j * size + i] = band;
      if (degrees >= 30) steep++;
    }
  }
  return { bands, size, maxDegrees, steepShare: steep / (size * size) };
}
