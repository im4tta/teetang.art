/** Builds the plate's downloadable files: contour SVG and 3D-printable STL. */
import { simplify, traceContours } from "./contours";
import { contourInterval, type PlateGeometry } from "./geometry";

const SVG_SIZE = 1000;
const SVG_MARGIN = 60;

export interface SvgCaption {
  title: string;
  subtitle: string;
}

const escapeXml = (text: string) => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Top-down contour drawing, ready for a pen plotter, laser cutter or print shop. */
export function buildContourSvg(
  geometry: PlateGeometry,
  { ink, paper, caption }: { ink: string; paper: string; caption?: SvgCaption },
): string {
  const interval = contourInterval(geometry.min, geometry.max);
  const toPx = (value: number) => ((value + 0.5) * SVG_SIZE).toFixed(1);
  const pathFor = (line: number[]) => {
    let d = "";
    for (let k = 0; k < line.length; k += 2) {
      d += `${k === 0 ? "M" : "L"}${toPx(line[k])} ${toPx(line[k + 1])}`;
    }
    return d;
  };

  const levels = traceContours(geometry, interval);
  const minor: string[] = [];
  const major: string[] = [];
  for (const level of levels) {
    for (const line of level.lines) {
      (level.index ? major : minor).push(pathFor(simplify(line, 0.0004)));
    }
  }

  let outline = "";
  for (let k = 0; k < geometry.outline.length; k += 2) {
    outline += `${k === 0 ? "M" : "L"}${toPx(geometry.outline[k])} ${toPx(geometry.outline[k + 1])}`;
  }
  outline += "Z";

  const captionHeight = caption ? 90 : 0;
  const width = SVG_SIZE + SVG_MARGIN * 2;
  const height = SVG_SIZE + SVG_MARGIN * 2 + captionHeight;
  const text = caption
    ? `<g fill="${ink}" font-family="'JetBrains Mono', ui-monospace, monospace" text-anchor="middle">` +
      `<text x="${width / 2}" y="${SVG_SIZE + SVG_MARGIN + 55}" font-size="30" letter-spacing="6">${escapeXml(caption.title)}</text>` +
      `<text x="${width / 2}" y="${SVG_SIZE + SVG_MARGIN + 88}" font-size="16" letter-spacing="2">${escapeXml(caption.subtitle)}</text>` +
      `</g>`
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
    `<title>${escapeXml(caption?.title ?? "Contours")}</title>`,
    `<desc>Contours every ${interval} m; heavier lines every ${interval * 5} m. Elevation: AWS Terrain Tiles.</desc>`,
    `<rect width="100%" height="100%" fill="${paper}"/>`,
    `<g transform="translate(${SVG_MARGIN} ${SVG_MARGIN})" fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">`,
    `<g id="contours" stroke-width="0.9">${minor.map((d) => `<path d="${d}"/>`).join("")}</g>`,
    `<g id="index-contours" stroke-width="1.8">${major.map((d) => `<path d="${d}"/>`).join("")}</g>`,
    `<path id="outline" d="${outline}" stroke-width="2.4"/>`,
    `</g>`,
    text,
    `</svg>`,
  ].join("\n");
}

/**
 * Binary STL in millimetres, Z up, as slicers expect. The surface, walls and
 * base close into one solid.
 */
export function buildStl(geometry: PlateGeometry, widthMm = 100): ArrayBuffer {
  const { surface, surfaceIndex, shell } = geometry;
  const triangles = surfaceIndex.length / 3 + shell.length / 9;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  const header = "teetang.art plate";
  for (let k = 0; k < header.length; k++) view.setUint8(k, header.charCodeAt(k));
  view.setUint32(80, triangles, true);

  // Lift the solid so its base rests on z = 0.
  const lift = geometry.baseDepth;
  let offset = 84;
  const writeTriangle = (corners: number[]) => {
    // Plate (x, y up, z south) → STL (x, y north, z up).
    const p = [0, 1, 2].map((c) => [
      corners[c * 3] * widthMm,
      -corners[c * 3 + 2] * widthMm,
      (corners[c * 3 + 1] + lift) * widthMm,
    ]);
    const ux = p[1][0] - p[0][0],
      uy = p[1][1] - p[0][1],
      uz = p[1][2] - p[0][2];
    const vx = p[2][0] - p[0][0],
      vy = p[2][1] - p[0][1],
      vz = p[2][2] - p[0][2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    for (const value of [nx, ny, nz, ...p[0], ...p[1], ...p[2]]) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
    offset += 2;
  };

  for (let k = 0; k < surfaceIndex.length; k += 3) {
    const corners: number[] = [];
    for (let c = 0; c < 3; c++) {
      const v = surfaceIndex[k + c] * 3;
      corners.push(surface[v], surface[v + 1], surface[v + 2]);
    }
    writeTriangle(corners);
  }
  for (let k = 0; k < shell.length; k += 9) writeTriangle(Array.from(shell.subarray(k, k + 9)));
  return buffer;
}
