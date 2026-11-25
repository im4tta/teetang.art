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
  /** The top edge of the walls, x, y, z per point, closed back to the start. */
  rim: Float32Array;
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
  options: {
    shape: PlateShape;
    exaggeration: number;
    sizeMeters: number;
    boxDepth: number;
    /**
     * Raises (positive height) or carves (negative) the surface where a 0..1
     * mask over the plate's square is set: a route ridge, or lakes and rivers.
     * Heights are in plate units.
     */
    reliefs?: ({ mask: Float32Array; size: number; height: number } | null)[];
    /**
     * A hollow base, in plate units: walls this thick, a roof this thick under
     * the lowest terrain, and a lip around the opening that a nail can hook
     * behind for hanging. Ignored when the base is too thin to hollow.
     */
    hollow?: { wall: number; roof: number; lip: number; lipHeight: number } | null;
    /** The elevation that sits on top of the base; tiles of one plate share it. Defaults to the lowest point. */
    baseMin?: number;
  },
): PlateGeometry {
  const { shape, exaggeration, sizeMeters, boxDepth, reliefs = [], hollow, baseMin } = options;
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

  if (baseMin !== undefined) min = Math.min(min, baseMin);
  const verticalScale = exaggeration / sizeMeters;
  for (let k = 0; k < count; k++) surface[k * 3 + 1] = (elevations[k] - min) * verticalScale;
  for (const relief of reliefs) {
    if (!relief || !relief.height) continue;
    const maskGrid = { size: relief.size, heights: relief.mask, min: 0, max: 1 };
    for (let k = 0; k < count; k++) {
      const amount = sampleGrid(maskGrid, uvs[k * 2], uvs[k * 2 + 1]);
      // Carving stops at the bottom of the terrain so the base stays solid.
      surface[k * 3 + 1] = Math.max(0, surface[k * 3 + 1] + amount * relief.height);
    }
  }

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
  const shellPoints: number[] = [];
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
    shellPoints.push(...p, ...(flip ? r : q), ...(flip ? q : r));
  };

  // A hollow base needs room for the lip and a roof under the lowest terrain.
  const lipTop = hollow ? bottom + hollow.lipHeight : bottom;
  const ceiling = hollow ? -hollow.roof : 0;
  const hollowed = Boolean(hollow && ceiling - lipTop > 0.002);
  // Moves a rim point towards the centre by `inset`, along its ray (every shape is star-shaped).
  const inset = (point: number[], by: number, y: number) => {
    const radius = Math.hypot(point[0], point[2]) || 1;
    const scale = Math.max(0.15, 1 - by / radius);
    return [point[0] * scale, y, point[2] * scale];
  };

  for (let index = 0; index < ring.length; index++) {
    const a = ring[index] * 3;
    const b = ring[(index + 1) % ring.length] * 3;
    const topA = [surface[a], surface[a + 1], surface[a + 2]];
    const topB = [surface[b], surface[b + 1], surface[b + 2]];
    const lowA = [topA[0], bottom, topA[2]];
    const lowB = [topB[0], bottom, topB[2]];
    const outward = [(topA[0] + topB[0]) / 2, 0, (topA[2] + topB[2]) / 2];
    const inward = [-outward[0], 0, -outward[2]];
    pushTriangle(topA, lowA, topB, outward);
    pushTriangle(topB, lowA, lowB, outward);
    if (!hollowed || !hollow) {
      pushTriangle([0, bottom, 0], lowA, lowB, [0, -1, 0]);
      continue;
    }
    // Opening (narrowed by the lip), lip, cavity walls and the cavity's roof.
    const openA = inset(lowA, hollow.wall + hollow.lip, bottom);
    const openB = inset(lowB, hollow.wall + hollow.lip, bottom);
    const lipA = [openA[0], lipTop, openA[2]];
    const lipB = [openB[0], lipTop, openB[2]];
    const wallA = inset(lowA, hollow.wall, lipTop);
    const wallB = inset(lowB, hollow.wall, lipTop);
    const roofA = [wallA[0], ceiling, wallA[2]];
    const roofB = [wallB[0], ceiling, wallB[2]];
    pushTriangle(lowA, lowB, openB, [0, -1, 0]);
    pushTriangle(lowA, openB, openA, [0, -1, 0]);
    pushTriangle(openA, openB, lipB, inward);
    pushTriangle(openA, lipB, lipA, inward);
    // The lip is solid below this step and the cavity is above it, so it faces up.
    pushTriangle(lipA, lipB, wallB, [0, 1, 0]);
    pushTriangle(lipA, wallB, wallA, [0, 1, 0]);
    pushTriangle(wallA, wallB, roofB, inward);
    pushTriangle(wallA, roofB, roofA, inward);
    pushTriangle([0, ceiling, 0], roofA, roofB, [0, -1, 0]);
  }
  const shell = new Float32Array(shellPoints);
  const rim = new Float32Array((ring.length + 1) * 3);
  for (let k = 0; k <= ring.length; k++) {
    const v = ring[k % ring.length] * 3;
    rim.set([surface[v], surface[v + 1], surface[v + 2]], k * 3);
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
    rim,
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

/**
 * A quick version of `sunlight` for moving the sun: shadows worked out on every
 * second grid point and spread back over the full grid. About four times
 * faster, with the same soft edges; the full version follows once the sun
 * stops. Small grids are already quick and use the full version.
 */
export function sunlightFast(
  surface: Float32Array,
  size: number,
  direction: [number, number, number],
): Float32Array {
  if (size < 200 || (size - 1) % 2 !== 0) return sunlight(surface, size, direction);
  const half = (size - 1) / 2 + 1;
  const coarse = new Float32Array(half * half * 3);
  for (let j = 0; j < half; j++) {
    for (let i = 0; i < half; i++) {
      coarse[(j * half + i) * 3 + 1] = surface[(j * 2 * size + i * 2) * 3 + 1];
    }
  }
  const lit = sunlight(coarse, half, direction);
  const out = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    const fj = j / 2;
    const j0 = Math.min(half - 2, Math.floor(fj));
    const tj = fj - j0;
    for (let i = 0; i < size; i++) {
      const fi = i / 2;
      const i0 = Math.min(half - 2, Math.floor(fi));
      const ti = fi - i0;
      const a = lit[j0 * half + i0];
      const b = lit[j0 * half + i0 + 1];
      const c = lit[(j0 + 1) * half + i0];
      const d = lit[(j0 + 1) * half + i0 + 1];
      out[j * size + i] = (a * (1 - ti) + b * ti) * (1 - tj) + (c * (1 - ti) + d * ti) * tj;
    }
  }
  return out;
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

/**
 * Where the sun is at a given hour (6 = sunrise in the east, 12 = high in the
 * south, 18 = sunset in the west), as a unit vector in plate axes (x east,
 * y up, z south), and how warm its light is (1 at the horizon, 0 at noon).
 */
export function sunAt(hour: number): { direction: [number, number, number]; warmth: number } {
  const t = Math.min(1, Math.max(0, (hour - 6) / 12));
  const azimuth = (90 + t * 180) * (Math.PI / 180);
  const elevation = (4 + Math.sin(t * Math.PI) * 62) * (Math.PI / 180);
  const direction: [number, number, number] = [
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    -Math.cos(elevation) * Math.cos(azimuth),
  ];
  return { direction, warmth: 1 - Math.sin(t * Math.PI) };
}

/**
 * Cast shadows: for each surface vertex, whether the sun is hidden by the
 * terrain, marching towards it across the grid (1 = lit, 0 = in shadow, with
 * soft edges). About 2.5 million samples for a 256-cell plate.
 */
export function sunlight(
  surface: Float32Array,
  size: number,
  direction: [number, number, number],
): Float32Array {
  const lit = new Float32Array(size * size).fill(1);
  const [dx, dy, dz] = direction;
  const flat = Math.hypot(dx, dz);
  if (flat < 1e-4) return lit;
  const cell = 1 / (size - 1);
  // Rise of the sun's ray per grid step, in plate units.
  const rise = (dy / flat) * cell;
  const stepX = dx / flat;
  const stepZ = dz / flat;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const height = surface[k * 3 + 1];
      let clearance = Infinity;
      for (let step = 1; step < size; step += step < 8 ? 1 : 2) {
        const x = Math.round(i + stepX * step);
        const y = Math.round(j + stepZ * step);
        if (x < 0 || y < 0 || x >= size || y >= size) break;
        const ray = height + rise * step;
        const terrain = surface[(y * size + x) * 3 + 1];
        clearance = Math.min(clearance, (ray - terrain) / (step * cell));
        if (clearance < -0.05) break;
      }
      // Soft edge: fully lit with a little room above the skyline.
      lit[k] = clearance === Infinity ? 1 : Math.min(1, Math.max(0, 0.5 + clearance * 6));
    }
  }
  return lit;
}
