/**
 * What can be seen from a point: a line-of-sight test over the plate's height
 * grid. Rays run from the viewpoint to every cell on the plate's edge, and each
 * ray tracks the steepest rise it has passed; a cell is visible when it climbs
 * at least that steeply. The curve of the Earth is included, since on a 50 km
 * plate it hides more than 100 m of distant ground.
 */
import type { HeightGrid } from "./elevationCore";

const EARTH_RADIUS_M = 6_371_000;
/** Light bends slightly down towards the ground, which shows a little more of it. */
const REFRACTION = 0.13;
/** Samples per grid cell along a ray; below 1 a thin ridge can slip between them. */
const STEPS_PER_CELL = 2;

export interface Viewshed {
  /** `size × size` cells, row by row from the north: 1 where the viewpoint can see the ground. */
  visible: Uint8Array;
  size: number;
  /** Share of the plate that is visible, 0..1. */
  fraction: number;
  /** Ground distance in metres to the farthest visible cell. */
  farthestM: number;
}

/**
 * @param grid the plate's heights
 * @param widthM ground width of the plate, in metres
 * @param u,v the viewpoint on the plate, 0..1 from the west and from the north
 * @param eyeM height of the eye above the ground, in metres
 */
export function computeViewshed(
  grid: HeightGrid,
  widthM: number,
  u: number,
  v: number,
  eyeM: number,
): Viewshed {
  const { size, heights } = grid;
  const last = size - 1;
  const cellM = widthM / last;
  const ox = Math.min(last, Math.max(0, u * last));
  const oy = Math.min(last, Math.max(0, v * last));
  const eye = heightAt(heights, size, ox, oy) + eyeM;
  const visible = new Uint8Array(size * size);
  visible[Math.round(oy) * size + Math.round(ox)] = 1;

  // How far the horizon drops at a distance: the Earth falls away from a level sight line.
  const drop = (d: number) => ((d * d) / (2 * EARTH_RADIUS_M)) * (1 - REFRACTION);

  const cast = (tx: number, ty: number) => {
    const dx = tx - ox;
    const dy = ty - oy;
    const cells = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(cells * STEPS_PER_CELL));
    let steepest = -Infinity;
    for (let s = 1; s <= steps; s++) {
      const x = ox + (dx * s) / steps;
      const y = oy + (dy * s) / steps;
      const d = (cells * cellM * s) / steps;
      const slope = (heightAt(heights, size, x, y) - drop(d) - eye) / d;
      if (slope >= steepest) {
        steepest = slope;
        visible[Math.round(y) * size + Math.round(x)] = 1;
      }
    }
  };

  for (let k = 0; k < size; k++) {
    cast(k, 0);
    cast(k, last);
    cast(0, k);
    cast(last, k);
  }

  let count = 0;
  let farthest = 0;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      if (!visible[j * size + i]) continue;
      count++;
      farthest = Math.max(farthest, Math.hypot(i - ox, j - oy));
    }
  }
  return { visible, size, fraction: count / (size * size), farthestM: farthest * cellM };
}

function heightAt(heights: Float32Array, size: number, x: number, y: number): number {
  const x0 = Math.min(size - 2, Math.max(0, Math.floor(x)));
  const y0 = Math.min(size - 2, Math.max(0, Math.floor(y)));
  const tx = Math.min(1, Math.max(0, x - x0));
  const ty = Math.min(1, Math.max(0, y - y0));
  const i = y0 * size + x0;
  const top = heights[i] * (1 - tx) + heights[i + 1] * tx;
  const bottom = heights[i + size] * (1 - tx) + heights[i + size + 1] * tx;
  return top * (1 - ty) + bottom * ty;
}
