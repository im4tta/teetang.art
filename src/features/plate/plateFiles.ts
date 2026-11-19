/** Contour SVG download. The STL and 3MF writers live in printModel.ts. */
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
