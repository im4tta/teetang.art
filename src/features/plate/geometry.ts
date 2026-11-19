/**
 * Builds the plate as plain arrays: the terrain surface, the walls and the
 * base. The 3D view, the STL file and the SVG contours all read the same
 * geometry, so what you download matches what you see.
 *
 * The plate is 1 unit wide, centred on the origin; +x is east, +z is south and
 * +y is up. The lowest point of the terrain sits at y = 0.
 */
import type { HeightGrid } from "./elevationCore";
import { warp, type PlateShape } from "./shapes";

export type { PlateShape };

export interface PlateGeometry {
  /** Vertices per side of the surface grid. */
  size: number;
  /** Surface vertices (x, y, z), row by row from the north. */
  surface: Float32Array;
  /** Surface texture coordinates in 0..1, matching the source square. */
  uvs: Float32Array;
  /** Real elevation of each surface vertex, in metres. */
  elevations: Float32Array;
  /** How open each surface vertex is to the sky: 1 on peaks and plains, lower in valleys. */
  ao: Float32Array;
  surfaceIndex: Uint32Array;
  /** Walls and base as a plain triangle list (x, y, z per corner). */
  shell: Float32Array;
  /** Outline of the plate's top edge in x, z pairs, for the shadow and SVG. */
  outline: Float32Array;
  min: number;
  max: number;
  peak: { u: number; v: number; metres: number };
  /** Vertical units per metre of elevation. */
  verticalScale: number;
  baseDepth: number;
}

function sampleGrid(grid: HeightGrid, u: number, v: number): number {
  const last = grid.size - 1;
  const fx = Math.min(last, Math.max(0, u * last));
  const fy = Math.min(last, Math.max(0, v * last));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(last, x0 + 1);
  const y1 = Math.min(last, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const h = grid.heights;
  const s = grid.size;
  const top = h[y0 * s + x0] * (1 - tx) + h[y0 * s + x1] * tx;
  const bottom = h[y1 * s + x0] * (1 - tx) + h[y1 * s + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Height multiplier that makes the relief readable: 1× for mountains, more for flat land. */
export function autoExaggeration(grid: HeightGrid, sizeMeters: number): number {
  const relief = Math.max(1, grid.max - grid.min);
  const value = (0.1 * sizeMeters) / relief;
  return Math.round(Math.min(25, Math.max(1, value)) * 2) / 2;
}

export function buildPlateGeometry(
  grid: HeightGrid,
  options: { shape: PlateShape; exaggeration: number; sizeMeters: number; boxDepth: number },
): PlateGeometry {
  const { shape, exaggeration, sizeMeters, boxDepth } = options;
  const size = grid.size;
  const count = size * size;
  const surface = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const elevations = new Float32Array(count);
  let min = Infinity;
  let max = -Infinity;
  let peak = { u: 0.5, v: 0.5, metres: -Infinity };

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const [x, z] = warp(shape, i / (size - 1) - 0.5, j / (size - 1) - 0.5);
      const u = x + 0.5;
      const v = z + 0.5;
      const metres = sampleGrid(grid, u, v);
      surface[k * 3] = x;
      surface[k * 3 + 2] = z;
      uvs[k * 2] = u;
      uvs[k * 2 + 1] = v;
      elevations[k] = metres;
      if (metres < min) min = metres;
      if (metres > max) {
        max = metres;
        peak = { u, v, metres };
      }
    }
  }

  const verticalScale = exaggeration / sizeMeters;
  for (let k = 0; k < count; k++) surface[k * 3 + 1] = (elevations[k] - min) * verticalScale;

  const cells = size - 1;
  const surfaceIndex = new Uint32Array(cells * cells * 6);
  let n = 0;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * size + i;
      const b = a + size;
      const c = a + 1;
      const d = b + 1;
      surfaceIndex.set([a, b, c, c, b, d], n);
      n += 6;
    }
  }

  // The rim, clockwise seen from above, without repeating corners.
  const ring: number[] = [];
  for (let i = 0; i < cells; i++) ring.push(i);
  for (let j = 0; j < cells; j++) ring.push(j * size + cells);
  for (let i = cells; i > 0; i--) ring.push(cells * size + i);
  for (let j = cells; j > 0; j--) ring.push(j * size);

  const outline = new Float32Array(ring.length * 2);
  ring.forEach((k, index) => {
    outline[index * 2] = surface[k * 3];
    outline[index * 2 + 1] = surface[k * 3 + 2];
  });

  const bottom = -boxDepth;
  const shell = new Float32Array(ring.length * 3 * 9);
  let s = 0;
  const pushTriangle = (p: number[], q: number[], r: number[], outward: number[]) => {
    // Keep every face pointing out of the solid so the STL is valid.
    const ux = q[0] - p[0],
      uy = q[1] - p[1],
      uz = q[2] - p[2];
    const vx = r[0] - p[0],
      vy = r[1] - p[1],
      vz = r[2] - p[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const flip = nx * outward[0] + ny * outward[1] + nz * outward[2] < 0;
    shell.set(flip ? [...p, ...r, ...q] : [...p, ...q, ...r], s);
    s += 9;
  };

  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] * 3;
    const b = ring[(index + 1) % ring.length] * 3;
    const topA = [surface[a], surface[a + 1], surface[a + 2]];
    const topB = [surface[b], surface[b + 1], surface[b + 2]];
    const lowA = [topA[0], bottom, topA[2]];
    const lowB = [topB[0], bottom, topB[2]];
    const outward = [(topA[0] + topB[0]) / 2, 0, (topA[2] + topB[2]) / 2];
    pushTriangle(topA, lowA, topB, outward);
    pushTriangle(topB, lowA, lowB, outward);
    pushTriangle([0, bottom, 0], lowA, lowB, [0, -1, 0]);
  }

  return {
    size,
    surface,
    uvs,
    elevations,
    ao: ambientOcclusion(surface, size),
    surfaceIndex,
    shell,
    outline,
    min,
    max,
    peak,
    verticalScale,
    baseDepth: boxDepth,
  };
}

/** A round contour step giving about `lines` lines from the lowest to the highest point. */
export function contourInterval(min: number, max: number, lines = 36): number {
  const raw = Math.max(1, (max - min) / lines);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10;
  return step * power;
}

const AO_DIRECTIONS = 8;
const AO_STEPS = [1, 2, 4, 7, 11, 16, 24];

/**
 * Horizon-based ambient occlusion over the surface grid: for each vertex, how
 * high the terrain rises around it in eight directions. Valleys and the foot
 * of cliffs get darker, as they do under an overcast sky. Runs once per plate
 * (about 2 million samples for a 256-cell grid).
 */
export function ambientOcclusion(surface: Float32Array, size: number): Float32Array {
  const ao = new Float32Array(size * size);
  const directions = Array.from({ length: AO_DIRECTIONS }, (_, k) => {
    const angle = (k / AO_DIRECTIONS) * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const cell = 1 / (size - 1);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const height = surface[k * 3 + 1];
      let open = 0;
      for (const [dx, dy] of directions) {
        let horizon = 0;
        for (const step of AO_STEPS) {
          const x = Math.round(i + dx * step);
          const y = Math.round(j + dy * step);
          if (x < 0 || y < 0 || x >= size || y >= size) break;
          const rise = surface[(y * size + x) * 3 + 1] - height;
          if (rise > 0) horizon = Math.max(horizon, rise / Math.hypot(rise, step * cell));
        }
        // horizon is the sine of the angle to the skyline in this direction.
        open += 1 - horizon;
      }
      ao[k] = open / AO_DIRECTIONS;
    }
  }
  return ao;
}
