/**
 * Print settings for the STL Studio. The plate's own settings (place, shape,
 * height, nameplate) stay in the plate draft, so the Studio and the 3D plate
 * always agree; these are the extra choices that only matter for printing.
 */

export type Material = "pla" | "petg" | "abs" | "tpu";

export interface PrintSettings {
  /** Printed width of the plate. */
  widthMm: number;
  /** Solid base under the lowest point. */
  baseMm: number;
  /** Terrain grid cells per side. */
  resolution: number;
  smooth: number;
  trimLow: number;
  trimHigh: number;
  /** How far letters stand out of, or sink into, the nameplate. */
  reliefMm: number;
  /** Filament colours stacked by height, for colour changes at set layers. */
  bands: number;
  colors: string[];
  /** Where each colour change happens, as a share of the terrain's height (0 = its lowest point). */
  cuts: number[];
  layerMm: number;
  bedMm: number;
  infill: number;
  material: Material;
  /** Hollow base with a hanging lip. */
  hollow: boolean;
  /** Tiles per side for a print bigger than the bed; 1 means one piece. */
  tiles: number;
  /** Lithophane thickness where the relief is brightest and darkest. */
  lithoThin: number;
  lithoThick: number;
}

export const WIDTH_LIMITS = { min: 40, max: 300 };
export const BASE_LIMITS = { min: 1, max: 30 };
export const RELIEF_LIMITS = { min: 0.4, max: 2.4 };
export const RESOLUTIONS = [
  { cells: 128, id: "draft" },
  { cells: 256, id: "normal" },
  { cells: 384, id: "fine" },
  { cells: 512, id: "ultra" },
] as const;
export const BED_SIZES = [180, 220, 256, 300, 350];
export const LAYER_HEIGHTS = [0.08, 0.12, 0.16, 0.2, 0.28];
export const MAX_BANDS = 5;

/** g/cm³ */
export const DENSITY: Record<Material, number> = { pla: 1.24, petg: 1.27, abs: 1.04, tpu: 1.21 };
export const MATERIALS = Object.keys(DENSITY) as Material[];

export const COLOR_SETS: { id: string; colors: string[] }[] = [
  { id: "mountain", colors: ["#3f6b3a", "#8a7350", "#a8a29e", "#e7e5e4", "#ffffff"] },
  { id: "desert", colors: ["#e7c48f", "#c98a4b", "#9a5a32", "#6b3a22", "#fef3c7"] },
  { id: "ocean", colors: ["#1e3a5f", "#2f6f9f", "#7fb6d4", "#d9eef6", "#ffffff"] },
  { id: "volcano", colors: ["#1c1917", "#57534e", "#b91c1c", "#f97316", "#fde68a"] },
  { id: "mono", colors: ["#1f1f1f", "#525252", "#a3a3a3", "#e5e5e5", "#ffffff"] },
];

export const DEFAULT_PRINT: PrintSettings = {
  widthMm: 100,
  baseMm: 5,
  resolution: 256,
  smooth: 1,
  trimLow: 0,
  trimHigh: 0,
  reliefMm: 0.8,
  bands: 1,
  colors: COLOR_SETS[0].colors,
  cuts: [0.25, 0.5, 0.75, 0.9],
  layerMm: 0.2,
  bedMm: 256,
  infill: 15,
  material: "pla",
  hollow: false,
  tiles: 1,
  lithoThin: 0.8,
  lithoThick: 3.2,
};

const KEY = "teetangart.studio.v1";
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function readPrintSettings(): PrintSettings {
  let saved: Partial<Record<keyof PrintSettings, unknown>> = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    // A broken or blocked store: start from the defaults.
  }
  const d = DEFAULT_PRINT;
  const colors = Array.isArray(saved.colors) ? saved.colors : [];
  const cuts = Array.isArray(saved.cuts) ? saved.cuts : [];
  return {
    widthMm: clamp(saved.widthMm, WIDTH_LIMITS.min, WIDTH_LIMITS.max, d.widthMm),
    baseMm: clamp(saved.baseMm, BASE_LIMITS.min, BASE_LIMITS.max, d.baseMm),
    resolution: RESOLUTIONS.some((r) => r.cells === saved.resolution)
      ? (saved.resolution as number)
      : d.resolution,
    smooth: Math.round(clamp(saved.smooth, 0, 6, d.smooth)),
    trimLow: clamp(saved.trimLow, 0, 0.8, d.trimLow),
    trimHigh: clamp(saved.trimHigh, 0, 0.5, d.trimHigh),
    reliefMm: clamp(saved.reliefMm, RELIEF_LIMITS.min, RELIEF_LIMITS.max, d.reliefMm),
    bands: Math.round(clamp(saved.bands, 1, MAX_BANDS, d.bands)),
    colors: d.colors.map((fallback, k) => (isHex(colors[k]) ? (colors[k] as string) : fallback)),
    cuts: d.cuts.map((fallback, k) => clamp(cuts[k], 0, 1, fallback)),
    layerMm: LAYER_HEIGHTS.includes(saved.layerMm as number)
      ? (saved.layerMm as number)
      : d.layerMm,
    bedMm: clamp(saved.bedMm, 100, 500, d.bedMm),
    infill: Math.round(clamp(saved.infill, 0, 100, d.infill)),
    material: MATERIALS.includes(saved.material as Material)
      ? (saved.material as Material)
      : d.material,
    hollow: saved.hollow === true,
    tiles: Math.round(clamp(saved.tiles, 1, 4, d.tiles)),
    lithoThin: clamp(saved.lithoThin, 0.4, 2, d.lithoThin),
    lithoThick: clamp(saved.lithoThick, 1.6, 6, d.lithoThick),
  };
}

export function writePrintSettings(settings: PrintSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Settings are a convenience; the Studio works without them.
  }
}

/** Colour-change heights in millimetres above the bed, lowest first, for the active bands. */
export function changeHeights(
  settings: PrintSettings,
  terrainBottomMm: number,
  terrainTopMm: number,
): number[] {
  const span = terrainTopMm - terrainBottomMm;
  const cuts = settings.cuts.slice(0, settings.bands - 1).sort((a, b) => a - b);
  // Snap to whole layers, since that is where a printer can pause.
  return cuts.map((cut) => {
    const mm = terrainBottomMm + span * cut;
    return Math.max(settings.layerMm, Math.round(mm / settings.layerMm) * settings.layerMm);
  });
}

/**
 * Rough filament use: walls and top and bottom skins are solid, the rest is
 * infill. Good to about ±20%, which is enough to know if a spool will do.
 */
export function estimateFilament(volumeCm3: number, areaCm2: number, settings: PrintSettings) {
  const skin = Math.min(volumeCm3, areaCm2 * 0.08);
  const used = skin + (volumeCm3 - skin) * (settings.infill / 100);
  const grams = used * DENSITY[settings.material];
  // 1.75 mm filament: π × 0.0875² cm² per cm.
  const metres = used / (Math.PI * 0.0875 ** 2) / 100;
  return { grams, metres };
}
