import themesManifest from "@/data/themes.json";
import additionalThemesManifest from "@/data/additional_themes.json";
import { blendHex, normalizeHexColor } from "@/utils/color";
import { getThemeColorByPath } from "@/services/theme/colorPaths";
import type { ResolvedTheme, ThemeColorKey, ThemeOption, ThemeGroup } from "@/services/theme/types";
import { DISPLAY_PALETTE_KEYS } from "@/services/theme/types";

const hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const rgbColorPattern =
  /^rgba?\(\s*\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}(?:\.\d+)?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
const hslColorPattern =
  /^hsla?\(\s*-?\d+(?:\.\d+)?(?:deg|rad|turn)?\s*,\s*\d+(?:\.\d+)?%\s*,\s*\d+(?:\.\d+)?%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i;
const colorReferencePattern = /^\$([a-zA-Z0-9_.]+)$/;

type ThemeObject = Record<string, unknown>;

const fallbackTheme: ResolvedTheme = {
  name: "Terracotta",
  description: "Mediterranean warmth - burnt orange and clay tones on cream",
  ui: {
    bg: "#F5EDE4",
    text: "#8B4513",
  },
  map: {
    land: "#F5EDE4",
    landcover: "#EFE7DA",
    water: "#A8C4C4",
    waterway: "#A8C4C4",
    parks: "#E8E0D0",
    buildings: "#E5C4B0",
    aeroway: "#D4C6B8",
    rail: "#8B4513",
    roads: {
      major: "#A0522D",
      minor_high: "#B87050",
      minor_mid: "#C9846A",
      minor_low: "#D9A08A",
      path: "#D9A08A",
      outline: "#F5EDE4",
    },
  },
};

const themeColorLookup: Record<ThemeColorKey, string[]> = {
  "ui.bg": ["ui.bg", "gradient_color", "bg"],
  "ui.text": ["ui.text", "text"],
  "map.land": ["map.land", "bg"],
  "map.landcover": ["map.landcover", "landcover"],
  "map.water": ["map.water", "water"],
  "map.waterway": ["map.waterway", "waterway", "map.water", "water"],
  "map.parks": ["map.parks", "parks"],
  "map.buildings": ["map.buildings", "building", "road_residential"],
  "map.aeroway": ["map.aeroway", "aeroway"],
  "map.rail": ["map.rail", "rail"],
  "map.roads.major": ["map.roads.major", "road_motorway", "road_primary"],
  "map.roads.minor_high": [
    "map.roads.minor_high",
    "map.roads.minor",
    "road_primary",
    "road_secondary",
  ],
  "map.roads.minor_mid": [
    "map.roads.minor_mid",
    "map.roads.minor",
    "road_secondary",
    "road_tertiary",
  ],
  "map.roads.minor_low": [
    "map.roads.minor_low",
    "map.roads.minor",
    "road_residential",
    "road_default",
  ],
  "map.roads.path": ["map.roads.path", "road_default", "road_tertiary", "road_residential"],
  "map.roads.outline": ["map.roads.outline", "road_outline", "bg"],
};

const referenceAliases: Record<string, string> = {
  bg: "ui.bg",
  text: "ui.text",
  gradient_color: "ui.bg",
  land: "map.land",
  landcover: "map.landcover",
  water: "map.water",
  waterway: "map.waterway",
  parks: "map.parks",
  building: "map.buildings",
  aeroway: "map.aeroway",
  rail: "map.rail",
  road_motorway: "map.roads.major",
  road_primary: "map.roads.major",
  road_secondary: "map.roads.minor_mid",
  road_tertiary: "map.roads.path",
  road_residential: "map.roads.path",
  road_default: "map.roads.path",
  road_outline: "map.roads.outline",
};

const preferredThemeOrder = [
  "angkor",
  "khmer_royal",
  "tonle_sap",
  "bakong",
  "apsara",
  "handmap",
  "midnight",
  "linen",
  "gold_ink",
  "dusk",
  "forest",
  "copper",
  "blueprint",
  "ember",
  "mono",
  "paper_white",
  "minimal",
  "rose",
  "forest_light",
  "midnight_blue",
  "terracotta",
  "neon",
  "coral",
  "heatwave",
  "ruby",
  "sage",
  "rustic",
  "old_navy",
  "gradient_roads",
  "monochrome_blue",
  "sunset",
  "autumn",
  "warm_beige",
  "risograph",
  "etching",
  "chalkboard",
  "mosaic_tile",
  "washi",
  "santorini",
  "holi",
  "alebrije",
  "jade_imperial",
  "kente",
  "tartan",
  "art_deco",
  "memphis",
  "vaporwave",
  "bauhaus",
  "aurora",
  "sakura",
  "topographic",
  "terrazzo",
  "prism",
  "transit",
  "newspaper",
];

function isObject(value: unknown): value is ThemeObject {
  return typeof value === "object" && value !== null;
}

function isCssColor(value: string): boolean {
  return hexColorPattern.test(value) || rgbColorPattern.test(value) || hslColorPattern.test(value);
}

function getPathValue(theme: ThemeObject, path: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = theme;

  for (const segment of segments) {
    if (!isObject(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function normalizeReferencePath(referencePath: string): string {
  const trimmed = String(referencePath ?? "").trim();
  if (!trimmed) return "";
  return referenceAliases[trimmed] || trimmed;
}

function resolveThemeColor(
  theme: ThemeObject,
  path: string,
  visitedPaths = new Set<string>(),
): string {
  if (!path || visitedPaths.has(path)) return "";

  const rawValue = getPathValue(theme, path);
  if (typeof rawValue !== "string") return "";

  const value = rawValue.trim();
  if (isCssColor(value)) return value;

  const referenceMatch = value.match(colorReferencePattern);
  if (!referenceMatch) return "";

  const referencedPath = normalizeReferencePath(referenceMatch[1]);
  if (!referencedPath || visitedPaths.has(referencedPath)) return "";

  const nextVisitedPaths = new Set(visitedPaths);
  nextVisitedPaths.add(path);
  nextVisitedPaths.add(referencedPath);
  return resolveThemeColor(theme, referencedPath, nextVisitedPaths);
}

function resolveByCandidates(theme: ThemeObject, candidates: string[]): string {
  for (const candidate of candidates) {
    const path = normalizeReferencePath(candidate);
    const color = resolveThemeColor(theme, path, new Set<string>());
    if (color) return color;
  }
  return "";
}

function normalizeTheme(themeInput: unknown): ResolvedTheme {
  const theme = isObject(themeInput) ? themeInput : {};

  const name = String(getPathValue(theme, "name") ?? "").trim() || fallbackTheme.name;
  const description =
    String(getPathValue(theme, "description") ?? "").trim() || fallbackTheme.description;

  const uiBg = resolveByCandidates(theme, themeColorLookup["ui.bg"]) || fallbackTheme.ui.bg;
  const uiText = resolveByCandidates(theme, themeColorLookup["ui.text"]) || fallbackTheme.ui.text;

  const land =
    resolveByCandidates(theme, themeColorLookup["map.land"]) || uiBg || fallbackTheme.map.land;
  const water =
    resolveByCandidates(theme, themeColorLookup["map.water"]) || fallbackTheme.map.water;
  const waterway = resolveByCandidates(theme, themeColorLookup["map.waterway"]) || water;
  const parks =
    resolveByCandidates(theme, themeColorLookup["map.parks"]) || fallbackTheme.map.parks;
  const landcover =
    resolveByCandidates(theme, themeColorLookup["map.landcover"]) || blendHex(land, parks, 0.35);

  const roadMajor = resolveByCandidates(theme, themeColorLookup["map.roads.major"]) || uiText;
  const roadMinorHigh =
    resolveByCandidates(theme, themeColorLookup["map.roads.minor_high"]) || roadMajor;
  const roadMinorMid =
    resolveByCandidates(theme, themeColorLookup["map.roads.minor_mid"]) || roadMinorHigh;
  const roadMinorLow =
    resolveByCandidates(theme, themeColorLookup["map.roads.minor_low"]) ||
    blendHex(roadMinorMid, land, 0.28);
  const roadPath = resolveByCandidates(theme, themeColorLookup["map.roads.path"]) || roadMinorLow;
  const roadOutline =
    resolveByCandidates(theme, themeColorLookup["map.roads.outline"]) ||
    blendHex(land, uiText, 0.12);

  const buildings =
    resolveByCandidates(theme, themeColorLookup["map.buildings"]) || blendHex(land, uiText, 0.14);
  const aeroway =
    resolveByCandidates(theme, themeColorLookup["map.aeroway"]) || blendHex(land, water, 0.2);

  const rail = (() => {
    const explicitRail = resolveByCandidates(theme, themeColorLookup["map.rail"]);
    if (explicitRail) return explicitRail;

    const normalizedTextHex = normalizeHexColor(uiText);
    if (!normalizedTextHex) return fallbackTheme.map.rail;
    return normalizedTextHex;
  })();

  return {
    name,
    description,
    ui: {
      bg: uiBg,
      text: uiText,
    },
    map: {
      land,
      landcover,
      water,
      waterway,
      parks,
      buildings,
      aeroway,
      rail,
      roads: {
        major: roadMajor,
        minor_high: roadMinorHigh,
        minor_mid: roadMinorMid,
        minor_low: roadMinorLow,
        path: roadPath,
        outline: roadOutline,
      },
    },
  };
}

const manifestThemes = isObject(themesManifest)
  ? (themesManifest as ThemeObject).themes
  : undefined;

const additionalRawThemes = isObject(additionalThemesManifest)
  ? (additionalThemesManifest as ThemeObject).themes
  : undefined;

const rawThemes = {
  ...(isObject(manifestThemes) ? (manifestThemes as Record<string, unknown>) : {}),
  ...(isObject(additionalRawThemes) ? (additionalRawThemes as Record<string, unknown>) : {}),
};

const themesByName: Record<string, ThemeObject> = Object.entries(rawThemes).reduce(
  (acc: Record<string, ThemeObject>, [key, value]) => {
    if (key && isObject(value)) {
      acc[key] = value;
    }
    return acc;
  },
  {},
);

const discoveredThemeNames = Object.keys(themesByName);
const preferredThemeNames = preferredThemeOrder.filter((id) => discoveredThemeNames.includes(id));
const remainingThemeNames = discoveredThemeNames.filter((id) => !preferredThemeOrder.includes(id));

export const themeNames = [...preferredThemeNames, ...remainingThemeNames];

export function getThemePalette(theme: unknown): string[] {
  const normalizedTheme = normalizeTheme(theme);
  return DISPLAY_PALETTE_KEYS.map((key) =>
    String(getThemeColorByPath(normalizedTheme, key) ?? "").trim(),
  ).filter((color) => isCssColor(color));
}

export const themeOptions: ThemeOption[] = themeNames.map((name) => ({
  id: name,
  name: String(getPathValue(themesByName[name], "name") ?? name),
  description: String(getPathValue(themesByName[name], "description") ?? ""),
  palette: getThemePalette(themesByName[name]),
}));

const themeOptionsById: Record<string, ThemeOption> = themeOptions.reduce(
  (acc: Record<string, ThemeOption>, option) => {
    if (!acc[option.id]) acc[option.id] = option;
    return acc;
  },
  {},
);

/**
 * Curated preset groupings for the theme picker. Each theme id maps to exactly
 * one category so the list can be filtered into compact, scrollable presets.
 */
const THEME_CATEGORY_ORDER: { id: string; name: string }[] = [
  { id: "editorial", name: "Editorial & Minimal" },
  { id: "warm", name: "Warm & Earthy" },
  { id: "dark", name: "Dark & Luxe" },
  { id: "vibrant", name: "Vibrant & Festive" },
  { id: "nature", name: "Nature & Coastal" },
  { id: "heritage", name: "Cultural & Heritage" },
  { id: "craft", name: "Art & Printcraft" },
];

const THEME_CATEGORY_MAP: Record<string, string> = {
  // Editorial & Minimal
  linen: "editorial",
  paper_white: "editorial",
  minimal: "editorial",
  coral: "editorial",
  sage: "editorial",
  contrast_zones: "editorial",
  ocean: "editorial",
  pastel_dream: "editorial",
  urban_mosaic: "editorial",
  forest_light: "editorial",
  iceberg: "editorial",
  mint: "editorial",
  gradient_roads: "editorial",
  monochrome_blue: "editorial",
  // Warm & Earthy
  copper: "warm",
  terracotta: "warm",
  rustic: "warm",
  copper_patina: "warm",
  sandstone: "warm",
  sunset: "warm",
  autumn: "warm",
  warm_beige: "warm",
  // Dark & Luxe
  midnight: "dark",
  gold_ink: "dark",
  dusk: "dark",
  ember: "dark",
  mono: "dark",
  rose: "dark",
  midnight_blue: "dark",
  heatwave: "dark",
  ruby: "dark",
  emerald: "dark",
  noir: "dark",
  volcanic: "dark",
  old_navy: "dark",
  jade_imperial: "dark",
  art_deco: "dark",
  // Vibrant & Festive
  neon: "vibrant",
  holi: "vibrant",
  alebrije: "vibrant",
  kente: "vibrant",
  tartan: "vibrant",
  vaporwave: "vibrant",
  prism: "vibrant",
  // Nature & Coastal
  forest: "nature",
  archipelago: "nature",
  mangrove: "nature",
  aurora: "nature",
  sakura: "nature",
  // Cultural & Heritage
  angkor: "heritage",
  khmer_royal: "heritage",
  tonle_sap: "heritage",
  bakong: "heritage",
  apsara: "heritage",
  japanese_ink: "heritage",
  wine: "heritage",
  nordic: "heritage",
  washi: "heritage",
  santorini: "heritage",
  // Art & Printcraft
  handmap: "craft",
  blueprint: "craft",
  vintage_plan: "craft",
  cyanotype: "craft",
  risograph: "craft",
  etching: "craft",
  chalkboard: "craft",
  mosaic_tile: "craft",
  memphis: "craft",
  bauhaus: "craft",
  topographic: "craft",
  terrazzo: "craft",
  transit: "craft",
  newspaper: "craft",
};

export const themeGroups: ThemeGroup[] = THEME_CATEGORY_ORDER.map((category) => ({
  id: category.id,
  name: category.name,
  options: themeNames
    .filter((name) => THEME_CATEGORY_MAP[name] === category.id)
    .map((name) => themeOptionsById[name])
    .filter((option): option is ThemeOption => Boolean(option)),
})).filter((group) => group.options.length > 0);

const preferredDefaultThemeName = "angkor";

export const defaultThemeName = themeNames.includes(preferredDefaultThemeName)
  ? preferredDefaultThemeName
  : (themeNames[0] ?? preferredDefaultThemeName);

export function getTheme(themeName: string): ResolvedTheme {
  if (themesByName[themeName]) {
    return normalizeTheme(themesByName[themeName]);
  }
  if (defaultThemeName && themesByName[defaultThemeName]) {
    return normalizeTheme(themesByName[defaultThemeName]);
  }
  return normalizeTheme(fallbackTheme);
}
