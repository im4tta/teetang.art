/**
 * Two ways to print a plate differently: split into tiles for a print bigger
 * than the printer's bed, or as a lithophane, a thin panel whose thickness
 * follows the shaded relief so the terrain shows when it is held to the light.
 */
import type { HeightGrid } from "../plate/elevationCore";
import { buildGridSolid } from "../plate/extras";
import { buildPlateGeometry } from "../plate/geometry";
import { modelParts, printSoups, writeStl, zip } from "../plate/printModel";
import { cylinder, subtract } from "./cutouts";

function sample(grid: HeightGrid, u: number, v: number): number {
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

/** The part of a square grid from (u0, v0), `span` wide, resampled to `cells` cells. */
function subGrid(
  grid: HeightGrid,
  u0: number,
  v0: number,
  span: number,
  cells: number,
): HeightGrid {
  const size = cells + 1;
  const heights = new Float32Array(size * size);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const h = sample(grid, u0 + (span * i) / cells, v0 + (span * j) / cells);
      heights[j * size + i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { size, heights, min, max };
}

export interface TileOptions {
  /** Tiles per side. */
  count: number;
  exaggeration: number;
  sizeMeters: number;
  widthMm: number;
  baseMm: number;
  /** Route ridge and water carve over the whole plate, as in the Studio. */
  reliefs: { mask: Float32Array; size: number; heightMm: number }[];
  hollow: boolean;
  /** Dowel holes where tiles meet, and printable pins to join them. */
  pins: boolean;
}

/** Dowel pin and hole sizes, in millimetres: a 3 mm pin in a 3.3 mm hole. */
const PIN = { radius: 1.5, hole: 1.65, depth: 5.5, minBase: 4.6 };

/**
 * Square tiles of the whole plate as a zip of STL files, named by row and
 * column from the north-west corner. Every tile shares the plate's base
 * level and vertical scale, so they line up edge to edge.
 */
export async function buildTilesZip(grid: HeightGrid, options: TileOptions): Promise<Blob> {
  const { count, widthMm } = options;
  const tileMm = widthMm / count;
  const cells = Math.max(32, Math.round((grid.size - 1) / count));
  const withPins = options.pins && count > 1 && options.baseMm >= PIN.minBase;
  const encoder = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      const u0 = col / count;
      const v0 = row / count;
      const span = 1 / count;
      const tile = subGrid(grid, u0, v0, span, cells);
      const reliefs = options.reliefs.map((relief) => {
        const maskGrid = { size: relief.size, heights: relief.mask, min: 0, max: 1 };
        return {
          mask: subGrid(maskGrid, u0, v0, span, cells).heights,
          size: cells + 1,
          height: relief.heightMm / tileMm,
        };
      });
      const geometry = buildPlateGeometry(tile, {
        shape: "square",
        exaggeration: options.exaggeration,
        sizeMeters: options.sizeMeters / count,
        boxDepth: options.baseMm / tileMm,
        baseMin: grid.min,
        reliefs,
        hollow: options.hollow
          ? { wall: 2.4 / tileMm, roof: 1.6 / tileMm, lip: 3 / tileMm, lipHeight: 1.2 / tileMm }
          : null,
      });
      let soups = printSoups(modelParts(geometry, null), tileMm, geometry.baseDepth);
      if (withPins) {
        // Two holes in the middle of the base on every edge shared with a neighbour.
        const half = tileMm / 2;
        const z = options.baseMm / 2;
        const holes: Float32Array[] = [];
        const along = [-tileMm / 4, tileMm / 4];
        const length = PIN.depth * 2;
        if (col > 0)
          along.forEach((y) => holes.push(cylinder("x", [-half, y, z], PIN.hole, length)));
        if (col < count - 1)
          along.forEach((y) => holes.push(cylinder("x", [half, y, z], PIN.hole, length)));
        // Row 1 is the north edge, at +y.
        if (row > 0)
          along.forEach((x) => holes.push(cylinder("y", [x, half, z], PIN.hole, length)));
        if (row < count - 1)
          along.forEach((x) => holes.push(cylinder("y", [x, -half, z], PIN.hole, length)));
        soups = [{ ...soups[0], soup: subtract(soups[0].soup, holes) }];
      }
      const name = `tile-r${row + 1}-c${col + 1}.stl`;
      files.push({ name, data: new Uint8Array(writeStl(soups, `teetang.art ${name}`)) });
    }
  }
  const pinCount = withPins ? 2 * 2 * count * (count - 1) : 0;
  if (withPins) {
    // One pin to print as many times as needed: 3 mm across, a little shorter than two holes.
    const pin = cylinder("z", [0, 0, (PIN.depth * 2 - 0.6) / 2], PIN.radius, PIN.depth * 2 - 0.6);
    files.push({
      name: "dowel-pin.stl",
      data: new Uint8Array(writeStl([{ soup: pin }], "dowel pin")),
    });
  }
  files.push({
    name: "README.txt",
    data: encoder.encode(
      `teetang.art plate in ${count * count} tiles, each ${tileMm.toFixed(1)} mm square.\n` +
        `Row 1 is the north edge, column 1 the west edge. Print each tile flat.\n` +
        (withPins
          ? `Print dowel-pin.stl ${pinCount} times, standing up. Push the pins into the holes in the ` +
            `tiles' sides to line them up, with a drop of glue.\n`
          : options.pins
            ? `The base is too thin for joining pins (it needs ${PIN.minBase} mm), so glue the tiles edge to edge.\n`
            : `Glue the tiles edge to edge.\n`),
    ),
  });
  return zip(files, "application/zip");
}

export interface LithophaneOptions {
  exaggeration: number;
  sizeMeters: number;
  widthMm: number;
  /** Thickness where the relief is brightest and darkest. */
  thinMm: number;
  thickMm: number;
}

/**
 * A lithophane of the shaded relief: thick where the slope faces away from a
 * north-west light (dark), thin where it faces the light (bright), with a
 * solid frame. About 0.25 mm per cell, the size of a nozzle's line.
 */
export function buildLithophaneStl(grid: HeightGrid, options: LithophaneOptions): ArrayBuffer {
  const { widthMm, thinMm, thickMm } = options;
  const frameMm = 3;
  const cells = Math.min(480, Math.round(widthMm / 0.25));
  // Light from the north-west, 45° up: east, north, up.
  const light = [-1, 1, 1.4];
  const length = Math.hypot(...light);
  const [lx, ly, lz] = light.map((v) => v / length);
  const step = 1 / cells;
  const metresPerStep = options.sizeMeters * step;
  const solid = buildGridSolid(
    cells,
    cells,
    { x0: -widthMm / 2, z0: -widthMm / 2, width: widthMm, depth: widthMm },
    0,
    (i, j) => {
      const xMm = (i / cells) * widthMm;
      const yMm = (j / cells) * widthMm;
      if (Math.min(xMm, yMm, widthMm - xMm, widthMm - yMm) < frameMm) return thickMm + 0.6;
      const u = i / cells;
      const v = j / cells;
      const dx = (sample(grid, u + step, v) - sample(grid, u - step, v)) / (2 * metresPerStep);
      // v grows to the south, so north is -v.
      const dy = (sample(grid, u, v - step) - sample(grid, u, v + step)) / (2 * metresPerStep);
      const nx = -dx * options.exaggeration;
      const ny = -dy * options.exaggeration;
      const norm = Math.hypot(nx, ny, 1);
      const bright = Math.max(0, (nx * lx + ny * ly + lz) / norm);
      return thinMm + (1 - bright) * (thickMm - thinMm);
    },
  );
  // Gather the top grid and the shell into one triangle list, in print axes (z up, mm).
  const soup = new Float32Array(solid.index.length * 3 + solid.shell.length);
  for (let k = 0; k < solid.index.length; k++) {
    const v = solid.index[k] * 3;
    soup.set(solid.surface.subarray(v, v + 3), k * 3);
  }
  soup.set(solid.shell, solid.index.length * 3);
  const [print] = printSoups([{ id: "terrain", soup }], 1, 0);
  return writeStl([print], "teetang.art lithophane");
}
