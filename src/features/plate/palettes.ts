/**
 * Colour ramps for the Elevation style, from the lowest point of the plate
 * (left) to the highest (right). Each one becomes a 256×1 texture.
 */
export const RELIEF_PALETTES = {
  classic: ["#5c8f5c", "#a9b56f", "#d4c580", "#b98f5e", "#99694a", "#f5f2ec"],
  alpine: ["#2f6b3a", "#6fa05a", "#c8c48a", "#9c8a76", "#8c8c8c", "#ffffff"],
  swiss: ["#9fb59a", "#c9d2a4", "#efe5b5", "#e8cfa0", "#d8c6b4", "#fbfaf6"],
  desert: ["#f3e1b9", "#e7b97a", "#d08a4c", "#a65a35", "#6e3a26", "#3d2318"],
  arctic: ["#16324f", "#2c6e96", "#7fb6d4", "#c6e2ef", "#eef7fb", "#ffffff"],
  volcanic: ["#141414", "#3b1210", "#7a1d0f", "#c2410c", "#f59e0b", "#fde68a"],
  tropical: ["#0b4f3c", "#1f7a4f", "#5ea64a", "#b7c95a", "#e6d38a", "#f6efd9"],
  viridis: ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"],
  magma: ["#000004", "#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"],
  mono: ["#1f1f1f", "#4a4a4a", "#7a7a7a", "#a8a8a8", "#d4d4d4", "#ffffff"],
} as const satisfies Record<string, readonly string[]>;

export type ReliefPalette = keyof typeof RELIEF_PALETTES;
export const RELIEF_PALETTE_IDS = Object.keys(RELIEF_PALETTES) as ReliefPalette[];

const hex = (color: string) => [1, 3, 5].map((k) => parseInt(color.slice(k, k + 2), 16));

/** RGBA bytes for a 256-pixel ramp through the palette's stops. */
export function paletteRamp(palette: ReliefPalette, width = 256): Uint8Array {
  const stops = RELIEF_PALETTES[palette].map(hex);
  const out = new Uint8Array(width * 4);
  for (let k = 0; k < width; k++) {
    const t = (k / (width - 1)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t));
    const f = t - i;
    for (let c = 0; c < 3; c++)
      out[k * 4 + c] = Math.round(stops[i][c] * (1 - f) + stops[i + 1][c] * f);
    out[k * 4 + 3] = 255;
  }
  return out;
}

/** CSS gradient for the palette picker's swatches. */
export const paletteGradient = (palette: ReliefPalette) =>
  `linear-gradient(90deg, ${RELIEF_PALETTES[palette].join(", ")})`;
