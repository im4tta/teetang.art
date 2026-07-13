export type PosterShape =
  | "rectangle"
  | "rounded"
  | "circle"
  | "diamond"
  | "hexagon"
  | "star"
  | "triangle"
  | "heart";

export function applyCanvasClip(
  ctx: CanvasRenderingContext2D,
  shape: PosterShape,
  w: number,
  h: number,
): void {
  if (shape === "rectangle") return;
  ctx.beginPath();
  switch (shape) {
    case "rounded":
      ctx.roundRect(0, 0, w, h, Math.min(w, h) * 0.04);
      break;
    case "circle": {
      const r = Math.min(w, h) / 2;
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      break;
    }
    case "diamond":
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w, h * 0.5);
      ctx.lineTo(w * 0.5, h);
      ctx.lineTo(0, h * 0.5);
      break;
    case "hexagon":
      ctx.moveTo(w * 0.25, 0);
      ctx.lineTo(w * 0.75, 0);
      ctx.lineTo(w, h * 0.5);
      ctx.lineTo(w * 0.75, h);
      ctx.lineTo(w * 0.25, h);
      ctx.lineTo(0, h * 0.5);
      break;
    case "star":
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w * 0.61, h * 0.35);
      ctx.lineTo(w * 0.98, h * 0.35);
      ctx.lineTo(w * 0.68, h * 0.57);
      ctx.lineTo(w * 0.79, h * 0.91);
      ctx.lineTo(w * 0.5, h * 0.7);
      ctx.lineTo(w * 0.21, h * 0.91);
      ctx.lineTo(w * 0.32, h * 0.57);
      ctx.lineTo(w * 0.02, h * 0.35);
      ctx.lineTo(w * 0.39, h * 0.35);
      break;
    case "triangle":
      ctx.moveTo(w * 0.5, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      break;
    case "heart":
      ctx.moveTo(w * 0.5, h * 0.12);
      ctx.lineTo(w * 0.63, h * 0.22);
      ctx.lineTo(w * 0.8, h * 0.12);
      ctx.lineTo(w * 0.97, h * 0.3);
      ctx.lineTo(w * 0.97, h * 0.55);
      ctx.lineTo(w * 0.5, h * 0.96);
      ctx.lineTo(w * 0.03, h * 0.55);
      ctx.lineTo(w * 0.03, h * 0.3);
      ctx.lineTo(w * 0.2, h * 0.12);
      ctx.lineTo(w * 0.37, h * 0.22);
      break;
  }
  ctx.closePath();
  ctx.clip();
}

export function svgClipPathElement(shape: PosterShape, w: number, h: number): string {
  switch (shape) {
    case "rectangle":
      return "";
    case "rounded": {
      const r = Math.min(w, h) * 0.04;
      return `<clipPath id="shapeClip"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" /></clipPath>`;
    }
    case "circle": {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2;
      return `<clipPath id="shapeClip"><circle cx="${cx}" cy="${cy}" r="${r}" /></clipPath>`;
    }
    case "diamond":
      return `<clipPath id="shapeClip"><polygon points="${w * 0.5},0 ${w},${h * 0.5} ${w * 0.5},${h} 0,${h * 0.5}" /></clipPath>`;
    case "hexagon":
      return `<clipPath id="shapeClip"><polygon points="${w * 0.25},0 ${w * 0.75},0 ${w},${h * 0.5} ${w * 0.75},${h} ${w * 0.25},${h} 0,${h * 0.5}" /></clipPath>`;
    case "star":
      return `<clipPath id="shapeClip"><polygon points="${w * 0.5},0 ${w * 0.61},${h * 0.35} ${w * 0.98},${h * 0.35} ${w * 0.68},${h * 0.57} ${w * 0.79},${h * 0.91} ${w * 0.5},${h * 0.7} ${w * 0.21},${h * 0.91} ${w * 0.32},${h * 0.57} ${w * 0.02},${h * 0.35} ${w * 0.39},${h * 0.35}" /></clipPath>`;
    case "triangle":
      return `<clipPath id="shapeClip"><polygon points="${w * 0.5},0 ${w},${h} 0,${h}" /></clipPath>`;
    case "heart":
      return `<clipPath id="shapeClip"><polygon points="${w * 0.5},${h * 0.12} ${w * 0.63},${h * 0.22} ${w * 0.8},${h * 0.12} ${w * 0.97},${h * 0.3} ${w * 0.97},${h * 0.55} ${w * 0.5},${h * 0.96} ${w * 0.03},${h * 0.55} ${w * 0.03},${h * 0.3} ${w * 0.2},${h * 0.12} ${w * 0.37},${h * 0.22}" /></clipPath>`;
  }
  return "";
}
