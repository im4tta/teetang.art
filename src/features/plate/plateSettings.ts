/** Everything that describes a plate, plus its share link and saved draft. */
import { SITE_URL } from "@/services/share/shareSheet";
import type { PlateShape } from "./geometry";
import type { PlateStyle } from "./PlateScene";

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
}

export const PLATE_STYLES: PlateStyle[] = ["drawing", "print", "map", "satellite"];
export const PLATE_SHAPES: PlateShape[] = ["square", "circle", "hexagon"];
export const SIZE_LIMITS = { min: 1, max: 50 };
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
  name: "Phnom Aural",
  region: "Kampong Speu",
  country: "Cambodia",
  countryCode: "KH",
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isHex = (value: string | null): value is string => !!value && /^#[0-9a-f]{6}$/i.test(value);

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
  const box = num(input.box);
  if (Number.isFinite(box)) out.box = clamp(box, BOX_LIMITS.min, BOX_LIMITS.max);
  if (PLATE_STYLES.includes(input.style as PlateStyle)) out.style = input.style as PlateStyle;
  if (PLATE_SHAPES.includes(input.shape as PlateShape)) out.shape = input.shape as PlateShape;
  if (typeof input.theme === "string" && /^[\w-]{1,40}$/.test(input.theme)) out.theme = input.theme;
  for (const key of ["ink", "paper", "side"] as const) {
    const value = input[key];
    if (typeof value === "string" && isHex(value)) out[key] = value;
  }
  if (input.shadow === false || input.shadow === "0") out.shadow = false;
  if (input.shadow === true || input.shadow === "1") out.shadow = true;
  for (const key of ["name", "region", "country"] as const) {
    const value = input[key];
    if (typeof value === "string") out[key] = value.slice(0, 80);
  }
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
