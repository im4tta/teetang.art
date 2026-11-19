/** Everything that describes a plate, plus its share link and saved draft. */
import { SITE_URL } from "@/services/share/shareSheet";
import { PLATE_SHAPES, type PlateShape } from "./shapes";
import type { PlateStyle } from "./PlateScene";
import { BASEMAPS } from "./basemaps";
import {
  LABEL_FONTS,
  formatCoordinates,
  scaleBar,
  type LabelContent,
  type LabelFont,
} from "./extras";
import { RELIEF_PALETTE_IDS, type ReliefPalette } from "./palettes";

export interface PlatePlace {
  name: string;
  region: string;
  country: string;
  countryCode: string;
}

export interface PlateSettings extends PlatePlace {
  lat: number;
  lon: number;
  sizeKm: number;
  style: PlateStyle;
  shape: PlateShape;
  /** Height multiplier; 0 means "choose for me". */
  exaggeration: number;
  /** Poster theme used by the Map style. */
  theme: string;
  ink: string;
  paper: string;
  side: string;
  /** Depth of the box under the terrain, as a share of the plate's width. */
  box: number;
  shadow: boolean;
  /** How many contour lines to draw. */
  density: PlateDensity;
  /** Raster map for the Topo and Satellite styles (see basemaps.ts). */
  basemap: string;
  /** Colour ramp for the Elevation style. */
  palette: ReliefPalette;
  /** A nameplate in front of the plate, with the title raised or engraved. */
  label: boolean;
  labelFont: LabelFont;
  labelRelief: LabelRelief;
  labelCoords: boolean;
  labelElevation: boolean;
  labelCompass: boolean;
  labelScale: boolean;
  /** A line of your own on the nameplate: a date, a trail, a dedication. */
  note: string;
  /** A pin on the highest point. */
  pin: boolean;
  /** The sea (0 m) drawn as water. */
  water: boolean;
  /** Rock layers on the sides of the box. */
  strata: boolean;
  /** Snow from this share of the relief upwards; 0 means none. */
  snow: number;
  /** Water up to this many metres above the lowest point; 0 means none. */
  flood: number;
}

export type LabelRelief = "raised" | "engraved";
export const LABEL_RELIEFS: LabelRelief[] = ["raised", "engraved"];
export { LABEL_FONTS, RELIEF_PALETTE_IDS };

export type PlateDensity = "fewer" | "normal" | "more";
export const PLATE_DENSITIES: PlateDensity[] = ["fewer", "normal", "more"];
/** About how many lines run from the lowest point to the highest. */
export const DENSITY_LINES: Record<PlateDensity, number> = { fewer: 16, normal: 30, more: 54 };

export { PLATE_SHAPES };
export const PLATE_STYLES: PlateStyle[] = [
  "drawing",
  "print",
  "elevation",
  "topo",
  "map",
  "satellite",
  "vintage",
];
export const SIZE_LIMITS = { min: 0.5, max: 100 };
/** Maps the Move mode can show under the square. */
export type PickerBase = "map" | "satellite" | "terrain";
export const PICKER_BASES: PickerBase[] = ["map", "satellite", "terrain"];

/** One-tap sizes in Move mode, in km. */
export const SIZE_PRESETS = [1, 3, 5, 10, 25, 50, 100];

/** Sizes read better rounded: 0.1 km steps under 2 km, 0.5 under 10, then whole km. */
export function roundSize(km: number): number {
  const clamped = Math.min(SIZE_LIMITS.max, Math.max(SIZE_LIMITS.min, km));
  const step = clamped < 2 ? 0.1 : clamped < 10 ? 0.5 : 1;
  return Math.round(Math.round(clamped / step) * step * 10) / 10;
}

// The size slider is logarithmic, so 1 km and 100 km are both easy to reach.
const SIZE_LOG = [Math.log(SIZE_LIMITS.min), Math.log(SIZE_LIMITS.max)] as const;
export const sizeToSlider = (km: number) =>
  ((Math.log(km) - SIZE_LOG[0]) / (SIZE_LOG[1] - SIZE_LOG[0])) * 100;
export const sliderToSize = (position: number) =>
  roundSize(Math.exp(SIZE_LOG[0] + (position / 100) * (SIZE_LOG[1] - SIZE_LOG[0])));
export const EXAGGERATION_LIMITS = { min: 0.5, max: 30 };
export const BOX_LIMITS = { min: 0.02, max: 0.2 };

export interface InkPreset {
  id: string;
  ink: string;
  paper: string;
  side: string;
}

export const INK_PRESETS: InkPreset[] = [
  { id: "paper", ink: "#1b1a17", paper: "#f4f2ec", side: "#1b1a17" },
  { id: "night", ink: "#ece6d6", paper: "#1f1e1b", side: "#0f0e0c" },
  { id: "blueprint", ink: "#eaf1ff", paper: "#24508f", side: "#16335c" },
  { id: "terracotta", ink: "#7a2e12", paper: "#f4e7d7", side: "#7a2e12" },
  { id: "forest", ink: "#1f3a2b", paper: "#eef0e4", side: "#1f3a2b" },
  { id: "gold", ink: "#8a6a1f", paper: "#fbf6e6", side: "#2a2418" },
  { id: "ocean", ink: "#dff3f7", paper: "#0f4c5c", side: "#0a313b" },
  { id: "rose", ink: "#7d2645", paper: "#fbe9ee", side: "#7d2645" },
  { id: "slate", ink: "#e2e8f0", paper: "#334155", side: "#1e293b" },
  { id: "sand", ink: "#5b4a2f", paper: "#efe4cc", side: "#3f3320" },
  { id: "sunset", ink: "#7c2d12", paper: "#fed7aa", side: "#9a3412" },
  { id: "mint", ink: "#14532d", paper: "#dcfce7", side: "#166534" },
];

export const DEFAULT_PLATE: PlateSettings = {
  lat: 12.0333,
  lon: 104.1667,
  sizeKm: 10,
  style: "drawing",
  shape: "square",
  exaggeration: 0,
  theme: "copper",
  ...INK_PRESETS[0],
  box: 0.06,
  shadow: true,
  density: "normal",
  basemap: "",
  palette: "classic",
  label: true,
  labelFont: "grotesk",
  labelRelief: "raised",
  labelCoords: true,
  labelElevation: true,
  labelCompass: true,
  labelScale: false,
  note: "",
  pin: false,
  water: true,
  strata: false,
  snow: 0,
  flood: 0,
  name: "Phnom Aural",
  region: "Kampong Speu",
  country: "Cambodia",
  countryCode: "KH",
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isHex = (value: string | null): value is string => !!value && /^#[0-9a-f]{6}$/i.test(value);

const BOOLEAN_FIELDS = [
  "shadow",
  "label",
  "labelCoords",
  "labelElevation",
  "labelCompass",
  "labelScale",
  "pin",
  "water",
  "strata",
] as const satisfies (keyof PlateSettings)[];

/** Short query names used by share links. */
const LINK = {
  lat: "lat",
  lon: "lon",
  sizeKm: "km",
  style: "style",
  shape: "shape",
  exaggeration: "h",
  theme: "theme",
  ink: "ink",
  paper: "paper",
  side: "side",
  box: "box",
  shadow: "shadow",
  density: "lines",
  basemap: "bm",
  palette: "pal",
  label: "label",
  labelFont: "font",
  labelRelief: "relief",
  labelCoords: "coords",
  labelElevation: "elev",
  labelCompass: "compass",
  labelScale: "scale",
  note: "note",
  pin: "pin",
  water: "water",
  strata: "strata",
  snow: "snow",
  flood: "flood",
  name: "name",
  region: "region",
  country: "country",
  countryCode: "cc",
} as const satisfies Record<keyof PlateSettings, string>;

/** Validates untrusted input (a link or an old draft) field by field. */
export function sanitizePlate(
  input: Partial<Record<keyof PlateSettings, unknown>>,
): Partial<PlateSettings> {
  const out: Partial<PlateSettings> = {};
  const num = (value: unknown) => (value === "" || value == null ? NaN : Number(value));
  const lat = num(input.lat);
  const lon = num(input.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180) {
    out.lat = lat;
    out.lon = lon;
  }
  const size = num(input.sizeKm);
  if (Number.isFinite(size)) out.sizeKm = clamp(size, SIZE_LIMITS.min, SIZE_LIMITS.max);
  const exaggeration = num(input.exaggeration);
  if (Number.isFinite(exaggeration)) {
    out.exaggeration =
      exaggeration === 0
        ? 0
        : clamp(exaggeration, EXAGGERATION_LIMITS.min, EXAGGERATION_LIMITS.max);
  }
  const snow = num(input.snow);
  if (Number.isFinite(snow)) out.snow = snow <= 0 ? 0 : clamp(snow, 0.3, 0.95);
  const flood = num(input.flood);
  if (Number.isFinite(flood)) out.flood = clamp(Math.round(flood), 0, 9000);
  const box = num(input.box);
  if (Number.isFinite(box)) out.box = clamp(box, BOX_LIMITS.min, BOX_LIMITS.max);
  if (PLATE_STYLES.includes(input.style as PlateStyle)) out.style = input.style as PlateStyle;
  if (PLATE_SHAPES.includes(input.shape as PlateShape)) out.shape = input.shape as PlateShape;
  if (PLATE_DENSITIES.includes(input.density as PlateDensity)) {
    out.density = input.density as PlateDensity;
  }
  if (typeof input.theme === "string" && /^[\w-]{1,40}$/.test(input.theme)) out.theme = input.theme;
  for (const key of ["ink", "paper", "side"] as const) {
    const value = input[key];
    if (typeof value === "string" && isHex(value)) out[key] = value;
  }
  for (const key of BOOLEAN_FIELDS) {
    if (input[key] === false || input[key] === "0") out[key] = false;
    if (input[key] === true || input[key] === "1") out[key] = true;
  }
  if (typeof input.basemap === "string" && BASEMAPS.some((map) => map.id === input.basemap)) {
    out.basemap = input.basemap;
  }
  if (RELIEF_PALETTE_IDS.includes(input.palette as ReliefPalette)) {
    out.palette = input.palette as ReliefPalette;
  }
  if (LABEL_FONTS.includes(input.labelFont as LabelFont))
    out.labelFont = input.labelFont as LabelFont;
  if (LABEL_RELIEFS.includes(input.labelRelief as LabelRelief)) {
    out.labelRelief = input.labelRelief as LabelRelief;
  }
  for (const key of ["name", "region", "country"] as const) {
    const value = input[key];
    if (typeof value === "string") out[key] = value.slice(0, 80);
  }
  if (typeof input.note === "string") out.note = input.note.slice(0, 60);
  if (typeof input.countryCode === "string" && /^[a-z]{2}$/i.test(input.countryCode)) {
    out.countryCode = input.countryCode.toUpperCase();
  }
  return out;
}

export function buildPlateLink(plate: PlateSettings): string {
  const params = new URLSearchParams();
  for (const [field, param] of Object.entries(LINK) as [keyof PlateSettings, string][]) {
    let value = plate[field];
    if (field === "lat" || field === "lon") value = (value as number).toFixed(5);
    if (typeof value === "boolean") value = value ? "1" : "0";
    if (value !== "" && value !== DEFAULT_PLATE[field]) params.set(param, String(value));
  }
  // A link always carries its place, even when it is the default one.
  params.set("lat", plate.lat.toFixed(5));
  params.set("lon", plate.lon.toFixed(5));
  return `${SITE_URL}/plate?${params}`;
}

export function parsePlateLink(search: string): Partial<PlateSettings> | null {
  const params = new URLSearchParams(search);
  if (!params.has("lat") || !params.has("lon")) return null;
  const raw: Partial<Record<keyof PlateSettings, unknown>> = {};
  for (const [field, param] of Object.entries(LINK) as [keyof PlateSettings, string][]) {
    if (params.has(param)) raw[field] = params.get(param);
  }
  const plate = sanitizePlate(raw);
  if (plate.lat === undefined) return null;
  // A shared place without a name should not inherit the default's name.
  return { name: "", region: "", country: "", countryCode: "", ...plate };
}

const DRAFT_KEY = "teetangart.plate.v1";

export function readPlateDraft(): Partial<PlateSettings> | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? sanitizePlate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writePlateDraft(plate: PlateSettings): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(plate));
  } catch {
    // Storage may be full or blocked; the plate still works without a draft.
  }
}

/** 🇰🇭 from "KH". */
export const flagEmoji = (countryCode: string) =>
  /^[A-Z]{2}$/.test(countryCode)
    ? String.fromCodePoint(...[...countryCode].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : "";

/** What the nameplate says, from the plate's settings; null when it is off or has no title. */
export function plateLabel(
  plate: PlateSettings,
  highestMetres: number | null,
  widthMm = 100,
): LabelContent | null {
  if (!plate.label || !plate.name.trim()) return null;
  const detail = [
    plate.labelCoords ? formatCoordinates(plate.lat, plate.lon) : "",
    plate.labelElevation && highestMetres !== null
      ? `▲ ${Math.round(highestMetres).toLocaleString("en-US")} m`
      : "",
  ].filter(Boolean);
  const lines = [
    [plate.region, plate.country].filter(Boolean).join(", "),
    plate.note.trim(),
    detail.join("   "),
  ].filter(Boolean);
  return {
    title: plate.name.trim(),
    lines,
    font: plate.labelFont,
    compass: plate.labelCompass,
    scale: plate.labelScale ? scaleBar(plate.sizeKm, widthMm) : null,
  };
}
