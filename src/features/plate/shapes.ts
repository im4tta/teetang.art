/**
 * Plate outlines. Every shape is star-shaped around the centre, so the square
 * grid can be pulled onto it along rays from the centre: the grid keeps its
 * order, the rim stays one closed ring, and the base can be a simple fan.
 *
 * Coordinates are plate units: x east, z south (down on screen), the plate
 * fits inside [-0.5, 0.5]².
 */

export const PLATE_SHAPES = [
  "square",
  "rounded",
  "circle",
  "hexagon",
  "octagon",
  "diamond",
  "triangle",
  "star",
] as const;

export type PlateShape = (typeof PLATE_SHAPES)[number];

const DEG = Math.PI / 180;

/** Polygon corners at the given angles (degrees; -90 points north) and radii. */
const polygon = (corners: [number, number][]) =>
  corners.map(([angle, radius]) => [
    Math.cos(angle * DEG) * radius,
    Math.sin(angle * DEG) * radius,
  ]);

const regular = (sides: number, start: number, radius: number) =>
  polygon(Array.from({ length: sides }, (_, k) => [start + (360 / sides) * k, radius]));

const POLYGONS: Partial<Record<PlateShape, number[][]>> = {
  hexagon: regular(6, 0, 0.5),
  // Flat sides touch the square's edges.
  octagon: regular(8, 22.5, 0.5 / Math.cos(22.5 * DEG)),
  diamond: regular(4, 0, 0.5),
  triangle: regular(3, -90, 0.5),
  star: polygon(Array.from({ length: 10 }, (_, k) => [-90 + 36 * k, k % 2 ? 0.21 : 0.5])),
};

/** Distance from the centre to the outline along the direction `theta`. */
function rayToPolygon(corners: number[][], theta: number): number {
  const dx = Math.cos(theta);
  const dz = Math.sin(theta);
  let best = Infinity;
  for (let k = 0; k < corners.length; k++) {
    const [ax, az] = corners[k];
    const [bx, bz] = corners[(k + 1) % corners.length];
    const ex = bx - ax;
    const ez = bz - az;
    const denominator = dx * ez - dz * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const t = (ax * ez - az * ex) / denominator;
    const s = (ax * dz - az * dx) / denominator;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
  }
  return best === Infinity ? 0.5 : best;
}

function outlineRadius(shape: PlateShape, theta: number): number {
  const corners = POLYGONS[shape];
  if (corners) return rayToPolygon(corners, theta);
  if (shape === "rounded") {
    // Superellipse: a square with soft corners.
    const n = 5;
    return 0.5 / (Math.abs(Math.cos(theta)) ** n + Math.abs(Math.sin(theta)) ** n) ** (1 / n);
  }
  return 0.5;
}

/** Moves a point of the square [-0.5, 0.5]² onto the shape, keeping the grid's order. */
export function warp(shape: PlateShape, u: number, v: number): [number, number] {
  if (shape === "square" || (u === 0 && v === 0)) return [u, v];
  if (shape === "circle") {
    // Shirley–Chiu concentric mapping: even spacing, no pinching at the centre.
    const a = 2 * u;
    const b = 2 * v;
    let r: number;
    let phi: number;
    if (Math.abs(a) > Math.abs(b)) {
      r = a;
      phi = (Math.PI / 4) * (b / a);
    } else {
      r = b;
      phi = Math.PI / 2 - (Math.PI / 4) * (a / b);
    }
    return [0.5 * r * Math.cos(phi), 0.5 * r * Math.sin(phi)];
  }
  const t = 2 * Math.max(Math.abs(u), Math.abs(v));
  const theta = Math.atan2(v, u);
  const radius = outlineRadius(shape, theta) * t;
  return [Math.cos(theta) * radius, Math.sin(theta) * radius];
}

/** An SVG path of the outline in a 24×24 box, for the shape picker's icons. */
export function shapeIconPath(shape: PlateShape): string {
  const steps = 96;
  let d = "";
  for (let k = 0; k < steps; k++) {
    // Walk the square's rim so polygon corners land exactly on points.
    const p = (k / steps) * 4;
    const side = Math.floor(p);
    const f = p - side - 0.5;
    const [u, v] = [
      [f, -0.5],
      [0.5, f],
      [-f, 0.5],
      [-0.5, -f],
    ][side];
    const [x, z] = warp(shape, u, v);
    d += `${k ? "L" : "M"}${(12 + x * 20).toFixed(2)} ${(12 + z * 20).toFixed(2)}`;
  }
  return `${d}Z`;
}
