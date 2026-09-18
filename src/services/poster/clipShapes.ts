export type PosterShape =
  "rectangle" | "rounded" | "circle" | "diamond" | "hexagon" | "star" | "triangle" | "heart";

type Point = readonly [number, number];

/**
 * Normalised outlines (x/y as fractions of the canvas width/height) for every
 * polygon shape. Single source of truth: the canvas clip, the SVG clip path and
 * `shapeSpansAt` all read from here so the footer layout always matches what is
 * actually visible.
 */
const SHAPE_POLYGONS: Partial<Record<PosterShape, readonly Point[]>> = {
  diamond: [
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ],
  hexagon: [
    [0.25, 0],
    [0.75, 0],
    [1, 0.5],
    [0.75, 1],
    [0.25, 1],
    [0, 0.5],
  ],
  star: [
    [0.5, 0],
    [0.61, 0.35],
    [0.98, 0.35],
    [0.68, 0.57],
    [0.79, 0.91],
    [0.5, 0.7],
    [0.21, 0.91],
    [0.32, 0.57],
    [0.02, 0.35],
    [0.39, 0.35],
  ],
  triangle: [
    [0.5, 0],
    [1, 1],
    [0, 1],
  ],
  heart: [
    [0.5, 0.12],
    [0.63, 0.22],
    [0.8, 0.12],
    [0.97, 0.3],
    [0.97, 0.55],
    [0.5, 0.96],
    [0.03, 0.55],
    [0.03, 0.3],
    [0.2, 0.12],
    [0.37, 0.22],
  ],
};

const ROUNDED_RADIUS_RATIO = 0.04;

export function applyCanvasClip(
  ctx: CanvasRenderingContext2D,
  shape: PosterShape,
  w: number,
  h: number,
): void {
  if (shape === "rectangle") return;
  ctx.beginPath();
  if (shape === "rounded") {
    ctx.roundRect(0, 0, w, h, Math.min(w, h) * ROUNDED_RADIUS_RATIO);
  } else if (shape === "circle") {
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  } else {
    const points = SHAPE_POLYGONS[shape];
    if (!points) return;
    ctx.moveTo(points[0][0] * w, points[0][1] * h);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0] * w, points[i][1] * h);
    }
  }
  ctx.closePath();
  ctx.clip();
}

function polygonPoints(shape: PosterShape, w: number, h: number): string {
  const points = SHAPE_POLYGONS[shape];
  if (!points) return "";
  return points.map(([x, y]) => `${x * w},${y * h}`).join(" ");
}

export function svgClipPathElement(shape: PosterShape, w: number, h: number): string {
  switch (shape) {
    case "rectangle":
      return "";
    case "rounded": {
      const r = Math.min(w, h) * ROUNDED_RADIUS_RATIO;
      return `<clipPath id="shapeClip"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" /></clipPath>`;
    }
    case "circle": {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2;
      return `<clipPath id="shapeClip"><circle cx="${cx}" cy="${cy}" r="${r}" /></clipPath>`;
    }
    default:
      return `<clipPath id="shapeClip"><polygon points="${polygonPoints(shape, w, h)}" /></clipPath>`;
  }
}

/**
 * Horizontal span(s) covered by a shape at a given y, in pixels. Concave
 * shapes (star, heart) can produce more than one span.
 */
export function shapeSpansAt(
  shape: PosterShape,
  w: number,
  h: number,
  y: number,
): [number, number][] {
  if (y < 0 || y > h) return [];

  if (shape === "rectangle") {
    return [[0, w]];
  }

  if (shape === "rounded") {
    const r = Math.min(w, h) * ROUNDED_RADIUS_RATIO;
    const dy = y < r ? r - y : y > h - r ? y - (h - r) : 0;
    const inset = dy > 0 ? r - Math.sqrt(Math.max(0, r * r - dy * dy)) : 0;
    return [[inset, w - inset]];
  }

  if (shape === "circle") {
    const r = Math.min(w, h) / 2;
    const dy = y - h / 2;
    if (Math.abs(dy) >= r) return [];
    const half = Math.sqrt(r * r - dy * dy);
    return [[w / 2 - half, w / 2 + half]];
  }

  const points = SHAPE_POLYGONS[shape];
  if (!points) return [[0, w]];

  const crossings: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const ay = y1 * h;
    const by = y2 * h;
    if ((ay <= y && by > y) || (by <= y && ay > y)) {
      crossings.push((x1 + ((x2 - x1) * (y - ay)) / (by - ay)) * w);
    }
  }
  crossings.sort((a, b) => a - b);

  const spans: [number, number][] = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    spans.push([crossings[i], crossings[i + 1]]);
  }
  return spans;
}
