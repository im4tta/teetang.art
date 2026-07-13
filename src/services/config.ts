/* ── App config ── */
export const CM_PER_INCH = 2.54;
export const [MIN_POSTER_CM, MAX_POSTER_CM] = [4, 45];
export const [DEFAULT_POSTER_WIDTH_CM, DEFAULT_POSTER_HEIGHT_CM] = [20, 30];
export const LAYOUT_MATCH_TOLERANCE_CM = 0.01;
export const [MIN_DISTANCE_METERS, MAX_DISTANCE_METERS, DEFAULT_DISTANCE_METERS] = [100, 20_000_000, 4_000];

export const REPO_URL = import.meta.env.VITE_REPO_URL ?? "";
export const REPO_API_URL = import.meta.env.VITE_REPO_API_URL ?? "";
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? "";
export const LEGAL_NOTICE_URL = import.meta.env.VITE_LEGAL_NOTICE_URL ?? "";
export const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL ?? "";

export const EARTH_CIRCUMFERENCE_M = 40_075_000;
export const TILE_SIZE_PX = 512;
export const [MIN_MAP_ZOOM, MAX_MAP_ZOOM] = [2, 18];
export const DEFAULT_CONTAINER_PX = 512;
export const FLY_TO_DURATION_MS = 600;
export const [DEFAULT_LAT, DEFAULT_LON] = [11.5564, 104.9282];
export const [DEFAULT_CITY, DEFAULT_COUNTRY] = ["Phnom Penh", "Cambodia"];

const env = import.meta.env;
export const SOCIAL_LINKEDIN = env.VITE_SOCIAL_LINKEDIN ?? "";
export const SOCIAL_INSTAGRAM = env.VITE_SOCIAL_INSTAGRAM ?? "";
export const SOCIAL_REDDIT = env.VITE_SOCIAL_REDDIT ?? "";
export const SOCIAL_THREADS = env.VITE_SOCIAL_THREADS ?? "";
export const SOCIAL_YOUTUBE = env.VITE_SOCIAL_YOUTUBE ?? "";
export const KOFI_URL = env.VITE_KOFI_URL ?? "";
export const DEVELOPER_NAME = env.VITE_DEVELOPER_NAME ?? "";
export const DEVELOPER_PROFILE_URL = env.VITE_DEVELOPER_PROFILE_URL ?? "";
export const APP_CREDIT_URL = env.VITE_APP_CREDIT_URL ?? "teetang.art";
export const APP_VERSION = String(env.VITE_APP_VERSION ?? "0.0.0").trim();
export const UPDATES_URL = String(env.VITE_UPDATES_URL ?? "/updates.json").trim();
export const INSTALL_DIAGNOSTICS_ENABLED = false;

export interface FontOption { value: string; label: string }
export interface TileProvider { id: string; label: string; type: "vector" | "raster"; url: string; attribution: string; maxZoom: number }

export const TILE_PROVIDERS: TileProvider[] = [
  { id: "openfreemap", label: "Default (Vector)", type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: "© OpenFreeMap", maxZoom: 14 },
  { id: "osm", label: "OpenStreetMap", type: "raster", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors", maxZoom: 19 },
  { id: "opentopo", label: "OpenTopoMap", type: "raster", url: "https://tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "© OpenTopoMap (CC-BY-SA)", maxZoom: 17 },
  { id: "carto-streets", label: "Street (Google-like)", type: "raster", url: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", attribution: "© CARTO", maxZoom: 20 },
  { id: "carto-light", label: "Light (Minimal)", type: "raster", url: "https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png", attribution: "© CARTO", maxZoom: 20 },
  { id: "carto-dark", label: "Dark", type: "raster", url: "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png", attribution: "© CARTO", maxZoom: 20 },
  { id: "satellite", label: "Satellite", type: "raster", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri", maxZoom: 19 },
];
export const DEFAULT_TILE_PROVIDER = "openfreemap";

export const RADIUS_OPTIONS = [
  { value: "0", label: "None" }, { value: "100", label: "100 m" }, { value: "250", label: "250 m" },
  { value: "500", label: "500 m" }, { value: "1000", label: "1 km" }, { value: "2000", label: "2 km" },
  { value: "5000", label: "5 km" },
];

export const FONT_OPTIONS: FontOption[] = [
  { value: "Moul", label: "ម Moul (Khmer)" }, { value: "Battambang", label: "ប Battambang (Khmer)" },
  { value: "Suwannaphum", label: "ស Suwannaphum (Khmer)" }, { value: "Kantumruy Pro", label: "ក Kantumruy Pro (Khmer)" },
  { value: "Hanuman", label: "ហ Hanuman (Khmer)" }, { value: "Koh Santepheap", label: "ខ Koh Santepheap (Khmer)" },
  { value: "Preahvihear", label: "ព Preahvihear (Khmer)" }, { value: "Siemreap", label: "ស Siemreap (Khmer)" },
  { value: "Noto Serif Khmer", label: "ន Noto Serif Khmer (Khmer)" }, { value: "Dangrek", label: "ដ Dangrek (Khmer)" },
  { value: "Bokor", label: "ប Bokor (Khmer)" }, { value: "Chenla", label: "ច Chenla (Khmer)" },
  { value: "Content", label: "ក Content (Khmer)" }, { value: "Fasthand", label: "ហ Fasthand (Khmer)" },
  { value: "Moulpali", label: "ម Moulpali (Khmer)" }, { value: "Koulen", label: "ក Koulen (Khmer)" },
  { value: "Anton", label: "Anton" }, { value: "Space Grotesk", label: "Space Grotesk" },
  { value: "Inter", label: "Inter" }, { value: "DM Serif Display", label: "DM Serif Display" },
  { value: "Libre Baskerville", label: "Libre Baskerville" }, { value: "", label: "Default (DM Sans)" },
  { value: "Montserrat", label: "Montserrat" }, { value: "Playfair Display", label: "Playfair Display" },
  { value: "Oswald", label: "Oswald" }, { value: "Raleway", label: "Raleway" },
  { value: "Lato", label: "Lato" }, { value: "Merriweather", label: "Merriweather" },
  { value: "Bebas Neue", label: "Bebas Neue" },
];
