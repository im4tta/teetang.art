/**
 * Cutting into a finished print model: dowel holes where tiles meet, and a
 * message and QR code engraved in the underside. All sizes are print
 * millimetres with x east, y north, z up and the base on z = 0.
 *
 * Booleans come from three-bvh-csg; every cutter here is a closed solid, as
 * it needs.
 */
import { BufferAttribute, BufferGeometry, CylinderGeometry, Matrix4 } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";

function brushOf(soup: Float32Array): Brush {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(soup, 3));
  const merged = mergeVertices(geometry, 1e-4);
  merged.computeVertexNormals();
  geometry.dispose();
  const brush = new Brush(merged);
  brush.updateMatrixWorld();
  return brush;
}

/** `solid` with every cutter taken out of it, as a triangle list. */
export function subtract(solid: Float32Array, cutters: Float32Array[]): Float32Array {
  if (!cutters.length) return solid;
  const evaluator = new Evaluator();
  evaluator.attributes = ["position", "normal"];
  evaluator.useGroups = false;
  // Constrained triangulation keeps the cut's edges conforming (no T-junctions),
  // so the result stays watertight. The setting is missing from the types.
  (evaluator as Evaluator & { useCDTClipping: boolean }).useCDTClipping = true;
  let result = brushOf(solid);
  for (const cutter of cutters) {
    const next = evaluator.evaluate(result, brushOf(cutter), SUBTRACTION);
    result.geometry.dispose();
    result = next;
  }
  const flat = result.geometry.index ? result.geometry.toNonIndexed() : result.geometry;
  const out = new Float32Array(flat.getAttribute("position").array as Float32Array);
  result.geometry.dispose();
  flat.dispose();
  return out;
}

/**
 * Raises the set cells of a `cols × rows` mask (row 0 at the north) into
 * boxes between z0 and z1 over `rect`, joined into one closed solid.
 * Cells touching only at a corner are joined, so every edge has two faces.
 */
export function extrudeMask(
  mask: Uint8Array,
  cols: number,
  rows: number,
  rect: { x0: number; y0: number; width: number; height: number },
  z0: number,
  z1: number,
): Float32Array {
  const on = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < cols && j < rows && mask[j * cols + i] === 1;
  for (let changed = true; changed;) {
    changed = false;
    for (let j = 0; j + 1 < rows; j++) {
      for (let i = 0; i + 1 < cols; i++) {
        const nw = on(i, j);
        const ne = on(i + 1, j);
        const sw = on(i, j + 1);
        const se = on(i + 1, j + 1);
        if ((nw && se && !ne && !sw) || (ne && sw && !nw && !se)) {
          mask[j * cols + i] = 1;
          mask[j * cols + i + 1] = 1;
          changed = true;
        }
      }
    }
  }
  const cw = rect.width / cols;
  const ch = rect.height / rows;
  // Column i runs east; row j runs south from the north edge (y0 + height).
  const x = (i: number) => rect.x0 + i * cw;
  const y = (j: number) => rect.y0 + rect.height - j * ch;
  const out: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) =>
    out.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!on(i, j)) continue;
      const [xa, xb, yn, ys] = [x(i), x(i + 1), y(j), y(j + 1)];
      // Counter-clockwise seen from outside each face.
      quad([xa, ys, z1], [xb, ys, z1], [xb, yn, z1], [xa, yn, z1]);
      quad([xa, ys, z0], [xa, yn, z0], [xb, yn, z0], [xb, ys, z0]);
      if (!on(i, j - 1)) quad([xa, yn, z0], [xa, yn, z1], [xb, yn, z1], [xb, yn, z0]);
      if (!on(i, j + 1)) quad([xa, ys, z0], [xb, ys, z0], [xb, ys, z1], [xa, ys, z1]);
      if (!on(i + 1, j)) quad([xb, ys, z0], [xb, yn, z0], [xb, yn, z1], [xb, ys, z1]);
      if (!on(i - 1, j)) quad([xa, ys, z0], [xa, ys, z1], [xa, yn, z1], [xa, yn, z0]);
    }
  }
  return new Float32Array(out);
}

/** A closed cylinder as a triangle list, along x or y, centred at `centre`. */
export function cylinder(
  axis: "x" | "y" | "z",
  centre: [number, number, number],
  radius: number,
  length: number,
): Float32Array {
  const geometry = new CylinderGeometry(radius, radius, length, 24, 1, false);
  // CylinderGeometry runs along y.
  if (axis === "x") geometry.applyMatrix4(new Matrix4().makeRotationZ(Math.PI / 2));
  if (axis === "z") geometry.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2));
  geometry.translate(...centre);
  const flat = geometry.toNonIndexed();
  const out = new Float32Array(flat.getAttribute("position").array as Float32Array);
  geometry.dispose();
  flat.dispose();
  return out;
}

const DEPTH = 0.6;
const CELL = 0.25;

/**
 * Text lines drawn on a canvas and turned into a mask at 0.25 mm per cell,
 * mirrored top to bottom so they read correctly when the plate is turned
 * over (north edge towards you).
 */
function textMask(
  lines: string[],
  widthMm: number,
): { mask: Uint8Array; cols: number; rows: number } {
  const lineMm = Math.min(7, widthMm / 14);
  const cols = Math.round(widthMm / CELL);
  const rows = Math.round((lines.length * lineMm * 1.4) / CELL);
  const canvas = Object.assign(document.createElement("canvas"), { width: cols, height: rows });
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const px = lineMm / CELL;
  lines.forEach((line, k) => {
    ctx.font = `700 ${px}px "Space Grotesk", "Kantumruy Pro", system-ui, sans-serif`;
    let size = px;
    while (ctx.measureText(line).width > cols * 0.96 && size > 4) {
      size *= 0.92;
      ctx.font = `700 ${size}px "Space Grotesk", "Kantumruy Pro", system-ui, sans-serif`;
    }
    ctx.fillText(line, cols / 2, (k + 0.5) * px * 1.4);
  });
  const { data } = ctx.getImageData(0, 0, cols, rows);
  const mask = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      mask[(rows - 1 - j) * cols + i] = data[(j * cols + i) * 4 + 3] > 127 ? 1 : 0;
    }
  }
  return { mask, cols, rows };
}

/**
 * Cutters for the underside: a message and a QR code to the plate's link,
 * engraved 0.6 mm deep. The QR code uses about 1 mm per module when it fits.
 */
export async function undersideCutters(options: {
  widthMm: number;
  message: string;
  link: string | null;
}): Promise<Float32Array[]> {
  const { widthMm } = options;
  const cutters: Float32Array[] = [];
  const half = widthMm / 2;
  // Overlap below the base so the cut opens cleanly through the bottom face.
  const z0 = -0.2;
  const z1 = DEPTH;
  let qrTop = -half * 0.1;
  if (options.link) {
    const { default: QRCode } = await import("qrcode");
    const code = QRCode.create(options.link, { errorCorrectionLevel: "M" });
    const modules = code.modules.size;
    const side = Math.min(widthMm * 0.5, modules * 1.0);
    // Mirrored top to bottom, like the text, so it scans the right way round.
    const mask = new Uint8Array(modules * modules);
    for (let j = 0; j < modules; j++) {
      for (let i = 0; i < modules; i++) {
        mask[(modules - 1 - j) * modules + i] = code.modules.get(j, i) ? 1 : 0;
      }
    }
    const rect = { x0: -side / 2, y0: -half * 0.05 - side, width: side, height: side };
    cutters.push(extrudeMask(mask, modules, modules, rect, z0, z1));
    qrTop = rect.y0 + side;
  }
  const lines = options.message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (lines.length) {
    const width = widthMm * 0.8;
    const { mask, cols, rows } = textMask(lines, width);
    const height = rows * CELL;
    const y0 = options.link ? qrTop + widthMm * 0.06 : -height / 2;
    cutters.push(extrudeMask(mask, cols, rows, { x0: -width / 2, y0, width, height }, z0, z1));
  }
  return cutters;
}
