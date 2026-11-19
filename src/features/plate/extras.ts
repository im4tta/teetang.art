/**
 * Extra solids around the terrain: a nameplate in front of the plate with the
 * place's name raised or engraved into it, and a pin on the summit.
 *
 * The text is drawn by the browser onto a canvas, so every script and font
 * the page can show (Khmer included) works. The canvas becomes a height field:
 * the nameplate's top is a grid whose heights follow the letters, closed by
 * walls and a base into one solid, the same way as the terrain. The 3D view,
 * the STL and the 3MF all use these solids.
 *
 * Units are plate units (the plate is 1 wide), +x east, +y up, +z south.
 */
import type { PlateGeometry } from "./geometry";

export const LABEL_FONTS = ["grotesk", "mono", "serif", "display"] as const;
export type LabelFont = (typeof LABEL_FONTS)[number];

const KHMER = '"Kantumruy Pro", "Noto Sans Khmer"';
const FONTS: Record<LabelFont, { title: string; body: string; spacing: number }> = {
  grotesk: {
    title: `700 {px}px "Space Grotesk", ${KHMER}, system-ui, sans-serif`,
    body: `600 {px}px "Space Grotesk", ${KHMER}, system-ui, sans-serif`,
    spacing: 0.06,
  },
  mono: {
    title: `500 {px}px "JetBrains Mono", ${KHMER}, ui-monospace, monospace`,
    body: `500 {px}px "JetBrains Mono", ${KHMER}, ui-monospace, monospace`,
    spacing: 0.12,
  },
  serif: {
    title: `700 {px}px Georgia, "Times New Roman", ${KHMER}, serif`,
    body: `600 {px}px Georgia, "Times New Roman", ${KHMER}, serif`,
    spacing: 0.05,
  },
  display: {
    title: `400 {px}px "Bebas Neue", ${KHMER}, Impact, sans-serif`,
    body: `600 {px}px "Space Grotesk", ${KHMER}, system-ui, sans-serif`,
    spacing: 0.1,
  },
};

const font = (template: string, px: number) => template.replace("{px}", px.toFixed(2));

export interface LabelContent {
  title: string;
  /** Smaller lines under the title, top to bottom. */
  lines: string[];
  font: LabelFont;
  compass: boolean;
  /** A scale bar: its distance and its length as a share of the plate's width. */
  scale: { text: string; fraction: number } | null;
}

/** A closed solid whose top is a grid with texture coordinates. */
export interface GridSolid {
  /** Top surface: positions (x, y, z), texture coordinates and triangle indices. */
  surface: Float32Array;
  uvs: Float32Array;
  index: Uint32Array;
  /** Walls and base as a triangle list. */
  shell: Float32Array;
}

export interface LabelSolid extends GridSolid {
  /** White letters on transparent, for colouring the nameplate in the 3D view. */
  texture: HTMLCanvasElement;
  /** Top of the nameplate around the letters. */
  top: number;
  rect: { x0: number; z0: number; width: number; depth: number };
}

export interface PinSolid {
  soup: Float32Array;
  tip: [number, number, number];
  metres: number;
}

export interface PlateExtras {
  label: LabelSolid | null;
  pin: PinSolid | null;
  /** How far the model reaches south of the plate's centre. */
  reach: number;
}

export interface ExtrasOptions {
  label: LabelContent | null;
  raised: boolean;
  pin: boolean;
  /** Printed width of the plate; relief depths are set in millimetres. */
  widthMm: number;
  /** How far letters stand out of, or sink into, the nameplate. */
  reliefMm: number;
  /** Grid cells per plate unit for the nameplate's top. */
  cellsPerUnit: number;
}

const LABEL_WIDTH = 0.84;
const PAD = 0.024;
const TITLE_SIZE = 0.068;
const LINE_SIZE = 0.03;
const LINE_GAP = 1.45;

interface Layout {
  width: number;
  depth: number;
  /** Room for the north arrow on the left and the scale bar on the right. */
  left: number;
  right: number;
}

function layoutFor(content: LabelContent): Layout {
  const lines = content.lines.length;
  const textDepth = TITLE_SIZE + lines * LINE_SIZE * LINE_GAP;
  return {
    width: LABEL_WIDTH,
    depth: PAD * 2 + textDepth + 0.006,
    left: content.compass ? 0.085 : 0,
    right: content.scale ? Math.max(0.085, content.scale.fraction + PAD * 0.5) : 0,
  };
}

/** Draws the label in white at `scale` pixels per plate unit, `offset` units from the top. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  content: LabelContent,
  layout: Layout,
  scale: number,
  offset: number,
) {
  const style = FONTS[content.font];
  const u = (value: number) => value * scale;
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";

  const top = offset + PAD;
  const columnLeft = PAD + layout.left;
  const columnWidth = layout.width - PAD * 2 - layout.left - layout.right;
  const centre = u(columnLeft + columnWidth / 2);

  const fitText = (text: string, template: string, size: number, spacing: number) => {
    let px = u(size);
    ctx.font = font(template, px);
    ctx.letterSpacing = `${px * spacing}px`;
    const measured = ctx.measureText(text).width;
    if (measured > u(columnWidth)) {
      px *= u(columnWidth) / measured;
      ctx.font = font(template, px);
      ctx.letterSpacing = `${px * spacing}px`;
    }
    return px;
  };

  // Title, in capitals for Latin scripts.
  const title = content.title.toLocaleUpperCase();
  fitText(title, style.title, TITLE_SIZE, style.spacing);
  ctx.fillText(title, centre, u(top + TITLE_SIZE * 0.8));

  // Smaller lines, slightly thickened so they survive a 0.4 mm nozzle.
  let y = top + TITLE_SIZE + LINE_SIZE * 0.95;
  for (const line of content.lines) {
    const px = fitText(line, style.body, LINE_SIZE, style.spacing * 0.6);
    ctx.lineWidth = px * 0.05;
    ctx.fillText(line, centre, u(y));
    ctx.strokeText(line, centre, u(y));
    y += LINE_SIZE * LINE_GAP;
  }
  ctx.letterSpacing = "0px";

  const blockTop = offset + PAD;
  const blockHeight = layout.depth - PAD * 2;
  if (content.compass) {
    // A north arrow: north is the far side of the plate, at the top of the label.
    const size = Math.min(blockHeight, layout.left);
    const cx = u(PAD + (layout.left - PAD * 0.5) / 2);
    const arrowTop = blockTop + 0.002;
    const arrowHeight = size * 0.62;
    ctx.beginPath();
    ctx.moveTo(cx, u(arrowTop));
    ctx.lineTo(cx + u(arrowHeight * 0.36), u(arrowTop + arrowHeight));
    ctx.lineTo(cx, u(arrowTop + arrowHeight * 0.74));
    ctx.lineTo(cx - u(arrowHeight * 0.36), u(arrowTop + arrowHeight));
    ctx.closePath();
    ctx.fill();
    ctx.font = font(FONTS.grotesk.title, u(size * 0.3));
    ctx.fillText("N", cx, u(arrowTop + arrowHeight + size * 0.32));
  }
  if (content.scale) {
    const length = content.scale.fraction;
    const right = layout.width - PAD;
    const left = right - length;
    const barY = blockTop + blockHeight * 0.42;
    const thick = 0.007;
    const tick = 0.018;
    ctx.fillRect(u(left), u(barY - thick / 2), u(length), u(thick));
    for (const x of [left, left + length / 2, right]) {
      const h = x === left + length / 2 ? tick * 0.6 : tick;
      ctx.fillRect(u(x - thick / 2), u(barY - h), u(thick), u(h));
    }
    const px = u(LINE_SIZE * 0.95);
    ctx.font = font(FONTS[content.font].body, px);
    ctx.lineWidth = px * 0.05;
    ctx.fillText(content.scale.text, u(left + length / 2), u(barY + LINE_SIZE * 1.25));
    ctx.strokeText(content.scale.text, u(left + length / 2), u(barY + LINE_SIZE * 1.25));
  }
}

/** Waits (briefly) for the label's web fonts, so the canvas does not fall back to a system font. */
async function loadFonts(content: LabelContent) {
  if (typeof document === "undefined" || !document.fonts) return;
  const style = FONTS[content.font];
  const sample = `${content.title}${content.lines.join("")}N`;
  const wait = Promise.all([
    document.fonts.load(font(style.title, 40), sample),
    document.fonts.load(font(style.body, 20), sample),
    document.fonts.load(font(FONTS.grotesk.title, 20), "N"),
  ]).catch(() => undefined);
  await Promise.race([wait, new Promise((resolve) => setTimeout(resolve, 1500))]);
}

function canvasOf(width: number, height: number) {
  return Object.assign(document.createElement("canvas"), {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  });
}

/** Signed so every face points out of the solid. */
function pushOriented(out: number[], p: number[], q: number[], r: number[], outward: number[]) {
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
  if (flip) out.push(...p, ...r, ...q);
  else out.push(...p, ...q, ...r);
}

/**
 * A rectangle of `cols × rows` cells whose top heights come from `heightAt`,
 * closed by walls down to `bottom` and a base.
 */
export function buildGridSolid(
  cols: number,
  rows: number,
  rect: { x0: number; z0: number; width: number; depth: number },
  bottom: number,
  heightAt: (i: number, j: number) => number,
): GridSolid {
  const stride = cols + 1;
  const count = stride * (rows + 1);
  const surface = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const k = j * stride + i;
      surface[k * 3] = rect.x0 + (rect.width * i) / cols;
      surface[k * 3 + 1] = heightAt(i, j);
      surface[k * 3 + 2] = rect.z0 + (rect.depth * j) / rows;
      uvs[k * 2] = i / cols;
      uvs[k * 2 + 1] = j / rows;
    }
  }
  const index = new Uint32Array(cols * rows * 6);
  let n = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * stride + i;
      const b = a + stride;
      const c = a + 1;
      const d = b + 1;
      index.set([a, b, c, c, b, d], n);
      n += 6;
    }
  }

  const ring: number[] = [];
  for (let i = 0; i < cols; i++) ring.push(i);
  for (let j = 0; j < rows; j++) ring.push(j * stride + cols);
  for (let i = cols; i > 0; i--) ring.push(rows * stride + i);
  for (let j = rows; j > 0; j--) ring.push(j * stride);

  const cx = rect.x0 + rect.width / 2;
  const cz = rect.z0 + rect.depth / 2;
  const shell: number[] = [];
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k] * 3;
    const b = ring[(k + 1) % ring.length] * 3;
    const topA = [surface[a], surface[a + 1], surface[a + 2]];
    const topB = [surface[b], surface[b + 1], surface[b + 2]];
    const lowA = [topA[0], bottom, topA[2]];
    const lowB = [topB[0], bottom, topB[2]];
    const outward = [(topA[0] + topB[0]) / 2 - cx, 0, (topA[2] + topB[2]) / 2 - cz];
    pushOriented(shell, topA, lowA, topB, outward);
    pushOriented(shell, topB, lowA, lowB, outward);
    pushOriented(shell, [cx, bottom, cz], lowA, lowB, [0, -1, 0]);
  }
  return { surface, uvs, index, shell: new Float32Array(shell) };
}

/** Where the plate's south edge runs between x = ±halfWidth: nearest and farthest. */
function southEdge(geometry: PlateGeometry, halfWidth: number): [number, number] {
  let near = Infinity;
  let far = -Infinity;
  const { outline } = geometry;
  for (let k = 0; k < outline.length; k += 2) {
    const x = outline[k];
    const z = outline[k + 1];
    if (z <= 0 || Math.abs(x) > halfWidth) continue;
    if (z < near) near = z;
    if (z > far) far = z;
  }
  return Number.isFinite(near) ? [near, far] : [0.5, 0.5];
}

function buildLabel(
  geometry: PlateGeometry,
  content: LabelContent,
  options: ExtrasOptions,
): LabelSolid {
  const layout = layoutFor(content);
  const [near, far] = southEdge(geometry, layout.width / 2);
  // The nameplate tucks a little under the plate, so the two print as one piece.
  const z0 = near - 0.004;
  const offset = far - z0;
  const rect = { x0: -layout.width / 2, z0, width: layout.width, depth: offset + layout.depth };

  const box = geometry.baseDepth;
  const bottom = -box;
  const relief = options.reliefMm / options.widthMm;
  const plinth = Math.min(box, Math.max(box * 0.55, relief + 2 / options.widthMm, 0.02));
  const top = bottom + plinth;

  const cols = Math.max(8, Math.round(rect.width * options.cellsPerUnit));
  const rows = Math.max(4, Math.round(rect.depth * options.cellsPerUnit));
  // One pixel per grid vertex; the canvas's own anti-aliasing gives sloped letter edges.
  const mask = canvasOf(cols + 1, rows + 1);
  const maskCtx = mask.getContext("2d", { willReadFrequently: true })!;
  drawLabel(maskCtx, content, layout, cols / rect.width, offset);
  const alpha = maskCtx.getImageData(0, 0, cols + 1, rows + 1).data;
  const sign = options.raised ? 1 : -1;
  // Letters never sit on the hidden strip under the plate.
  const solid = buildGridSolid(cols, rows, rect, bottom, (i, j) => {
    const covered = alpha[(j * (cols + 1) + i) * 4 + 3] / 255;
    return top + sign * relief * covered;
  });

  const textureScale = Math.min(4096 / rect.width, Math.max(1600, options.cellsPerUnit * 3));
  const texture = canvasOf(rect.width * textureScale, rect.depth * textureScale);
  drawLabel(texture.getContext("2d")!, content, layout, texture.width / rect.width, offset);
  return { ...solid, texture, top, rect };
}

function buildPin(geometry: PlateGeometry, widthMm: number): PinSolid {
  const x = geometry.peak.u - 0.5;
  const z = geometry.peak.v - 0.5;
  const ground = (geometry.peak.metres - geometry.min) * geometry.verticalScale;
  // About 6 mm tall and 2.6 mm across on a 10 cm plate, never thinner than 1.6 mm.
  const height = 0.06;
  const radius = Math.max(0.013, 0.8 / widthMm);
  const base = ground - 0.012;
  const apex = [x, ground + height, z];
  const out: number[] = [];
  const segments = 28;
  for (let k = 0; k < segments; k++) {
    const a = (k / segments) * Math.PI * 2;
    const b = ((k + 1) / segments) * Math.PI * 2;
    const pa = [x + Math.cos(a) * radius, base, z + Math.sin(a) * radius];
    const pb = [x + Math.cos(b) * radius, base, z + Math.sin(b) * radius];
    const mid = (a + b) / 2;
    pushOriented(out, pa, pb, apex, [Math.cos(mid), 0.2, Math.sin(mid)]);
    pushOriented(out, [x, base, z], pb, pa, [0, -1, 0]);
  }
  return {
    soup: new Float32Array(out),
    tip: apex as [number, number, number],
    metres: geometry.peak.metres,
  };
}

export async function buildPlateExtras(
  geometry: PlateGeometry,
  options: ExtrasOptions,
): Promise<PlateExtras> {
  let label: LabelSolid | null = null;
  if (options.label && options.label.title.trim()) {
    await loadFonts(options.label);
    label = buildLabel(geometry, options.label, options);
  }
  const pin = options.pin ? buildPin(geometry, options.widthMm) : null;
  const reach = label ? label.rect.z0 + label.rect.depth : 0.5;
  return { label, pin, reach };
}

/**
 * A round distance of at most a fifth of the plate's width for the scale bar,
 * with the true map scale of the print, e.g. "2 km · 1:100,000".
 */
export function scaleBar(sizeKm: number, widthMm = 100): { text: string; fraction: number } {
  const target = sizeKm / 5;
  const power = 10 ** Math.floor(Math.log10(target));
  const step = [5, 2, 1].map((m) => m * power).find((value) => value <= target) ?? power;
  const distance = step < 1 ? `${Math.round(step * 1000)} m` : `${step} km`;
  // Round the ratio to two significant figures, as printed maps do.
  const ratio = (sizeKm * 1e6) / widthMm;
  const magnitude = 10 ** (Math.floor(Math.log10(ratio)) - 1);
  const rounded = Math.round(ratio / magnitude) * magnitude;
  return { text: `${distance} · 1:${rounded.toLocaleString("en-US")}`, fraction: step / sizeKm };
}

const hemisphere = (value: number, positive: string, negative: string) =>
  `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;

export const formatCoordinates = (lat: number, lon: number) =>
  `${hemisphere(lat, "N", "S")}  ${hemisphere(lon, "E", "W")}`;
