/**
 * The elevation data a plate can be built from. The worldwide AWS Terrain
 * Tiles are the default and always work; the others are opt-in upgrades that
 * fall back to them when they cannot answer.
 *
 * Plate settings keep only the id (`plate.elevation`); keys never go in links.
 */
import type { PlateBounds } from "./geo";

export interface ElevationSource {
  /** Value stored in `plate.elevation`; "" is the worldwide default. */
  id: string;
  name: string;
  /** One line for the credit under the plate. */
  credit: string;
  resolutionM: number;
  /** Needs a visitor's own key (kept on their device only). */
  needsKey?: boolean;
  /** Largest plate, in km, this source is asked for; bigger plates use the default. */
  maxKm?: number;
  /** Whether the plate lies where this source has data. */
  covers(bounds: PlateBounds): boolean;
}

const everywhere = () => true;

/** Rough boxes around the United States; the server reports real coverage. */
const US_BOXES: [south: number, north: number, west: number, east: number][] = [
  [24.3, 49.6, -125.1, -66.8],
  [51, 71.6, -170, -129.9],
  [18.7, 22.5, -160.7, -154.7],
  [17.8, 18.7, -67.5, -65.1],
];

const insideUs = (b: PlateBounds) =>
  US_BOXES.some(
    ([south, north, west, east]) =>
      b.south >= south && b.north <= north && b.west >= west && b.east <= east,
  );

export const DEFAULT_SOURCE: ElevationSource = {
  id: "",
  name: "Worldwide (AWS Terrain Tiles)",
  credit: "AWS Terrain Tiles",
  resolutionM: 30,
  covers: everywhere,
};

export const ELEVATION_SOURCES: ElevationSource[] = [
  DEFAULT_SOURCE,
  {
    id: "copernicus",
    name: "Copernicus GLO-30 (ESA)",
    credit: "Copernicus DEM GLO-30 © ESA",
    resolutionM: 30,
    covers: (b) => b.south > -85 && b.north < 85,
  },
  {
    id: "usgs3dep",
    name: "USGS 3DEP lidar",
    credit: "USGS 3D Elevation Program",
    resolutionM: 1,
    maxKm: 25,
    covers: insideUs,
  },
  {
    id: "ot:AW3D30",
    name: "ALOS World 3D 30 m (JAXA)",
    credit: "ALOS World 3D 30 m © JAXA, via OpenTopography",
    resolutionM: 30,
    needsKey: true,
    maxKm: 50,
    covers: (b) => b.south > -82 && b.north < 82,
  },
  {
    id: "ot:COP30",
    name: "Copernicus 30 m (OpenTopography)",
    credit: "Copernicus DEM GLO-30 © ESA, via OpenTopography",
    resolutionM: 30,
    needsKey: true,
    maxKm: 50,
    covers: (b) => b.south > -85 && b.north < 85,
  },
  {
    id: "ot:NASADEM",
    name: "NASADEM (NASA)",
    credit: "NASADEM © NASA, via OpenTopography",
    resolutionM: 30,
    needsKey: true,
    maxKm: 50,
    covers: (b) => b.south > -56 && b.north < 60,
  },
];

export const sourceById = (id: string): ElevationSource | undefined =>
  ELEVATION_SOURCES.find((source) => source.id === id);

/** Only known ids survive; anything else (an old link, a typo) means the default. */
export const sanitizeSourceId = (value: unknown): string =>
  typeof value === "string" && sourceById(value) ? value : "";

/** The OpenTopography dataset behind an `ot:` id, as the API names it. */
export const openTopoDataset = (id: string): string | null =>
  id.startsWith("ot:") ? id.slice(3) : null;

/** OpenTopography keys are plain alphanumerics; anything else is not sent. */
export const isOpenTopoKey = (key: unknown): key is string =>
  typeof key === "string" && /^[A-Za-z0-9]{16,64}$/.test(key);

const KEY_STORAGE = "teetangart.opentopo.key";

export function readOpenTopoKey(): string {
  try {
    const key = window.localStorage.getItem(KEY_STORAGE);
    return isOpenTopoKey(key) ? key : "";
  } catch {
    return "";
  }
}

export function saveOpenTopoKey(key: string): boolean {
  try {
    if (!key) window.localStorage.removeItem(KEY_STORAGE);
    else if (isOpenTopoKey(key)) window.localStorage.setItem(KEY_STORAGE, key);
    else return false;
    return true;
  } catch {
    return false;
  }
}
