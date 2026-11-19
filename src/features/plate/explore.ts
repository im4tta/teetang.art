/**
 * Curated plates with a short story each, Cambodia first. Opening one sets
 * the place, the square and a look that suits it.
 */
import type { PlateSettings } from "./plateSettings";

export interface ExplorePlace {
  id: string;
  name: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  sizeKm: number;
  /** Settings that show the place at its best. */
  look: Partial<PlateSettings>;
  story: { en: string; km: string };
}

const KH = { country: "Cambodia", countryCode: "KH" };

export const EXPLORE_CAMBODIA: ExplorePlace[] = [
  {
    id: "aural",
    name: "Phnom Aural",
    region: "Kampong Speu",
    ...KH,
    lat: 12.0333,
    lon: 104.1667,
    sizeKm: 10,
    look: { style: "elevation", palette: "tropical", pin: true },
    story: {
      en: "Cambodia's highest mountain, about 1,813 m, in the eastern Cardamom range.",
      km: "ភ្នំខ្ពស់ជាងគេនៅកម្ពុជា ប្រហែល ១.៨១៣ ម៉ែត្រ ក្នុងជួរភ្នំក្រវាញខាងកើត។",
    },
  },
  {
    id: "kulen",
    name: "Phnom Kulen",
    region: "Siem Reap",
    ...KH,
    lat: 13.565,
    lon: 104.1,
    sizeKm: 16,
    look: { style: "drawing", lakes: true },
    story: {
      en: "A sacred sandstone plateau north of Angkor, where the Khmer Empire was proclaimed in 802 AD.",
      km: "ខ្ពង់រាបថ្មភក់ដ៏ពិសិដ្ឋខាងជើងអង្គរ ជាកន្លែងប្រកាសចក្រភពខ្មែរក្នុងឆ្នាំ ៨០២។",
    },
  },
  {
    id: "bokor",
    name: "Bokor Mountain",
    region: "Kampot",
    ...KH,
    lat: 10.62,
    lon: 104.02,
    sizeKm: 14,
    look: { style: "vintage", water: true },
    story: {
      en: "A plateau above Kampot and the sea, home to a hill station built in the 1920s.",
      km: "ខ្ពង់រាបពីលើកំពត និងសមុទ្រ មានទីតាំងរមណីយដ្ឋានលើភ្នំដែលសាងសង់ក្នុងទសវត្សរ៍ ១៩២០។",
    },
  },
  {
    id: "angkor",
    name: "Angkor Wat",
    region: "Siem Reap",
    ...KH,
    lat: 13.4125,
    lon: 103.867,
    sizeKm: 6,
    look: { style: "satellite", exaggeration: 20 },
    story: {
      en: "The 12th-century temple and its wide moat: almost flat land, so the height is raised to show it.",
      km: "ប្រាសាទសតវត្សរ៍ទី ១២ និងគូទឹកធំទូលាយ៖ ដីស្ទើររាបស្មើ ដូច្នេះកម្ពស់ត្រូវបានពង្រីកដើម្បីបង្ហាញ។",
    },
  },
  {
    id: "preah-vihear",
    name: "Preah Vihear Temple",
    region: "Preah Vihear",
    ...KH,
    lat: 14.3906,
    lon: 104.6797,
    sizeKm: 8,
    look: { style: "print" },
    story: {
      en: "A temple on the edge of a cliff in the Dângrêk Mountains, a UNESCO World Heritage Site since 2008.",
      km: "ប្រាសាទលើគែមច្រាំងថ្មនៃជួរភ្នំដងរែក ជាបេតិកភណ្ឌពិភពលោក UNESCO តាំងពីឆ្នាំ ២០០៨។",
    },
  },
  {
    id: "tonle-sap",
    name: "Tonlé Sap",
    region: "Siem Reap",
    ...KH,
    lat: 12.85,
    lon: 104.1,
    sizeKm: 60,
    look: { style: "elevation", palette: "swiss", flood: 6, lakes: true, exaggeration: 30 },
    story: {
      en: "Southeast Asia's largest lake, which swells several times over in the rainy season. Raise the water level to see the flood.",
      km: "បឹងធំជាងគេនៅអាស៊ីអាគ្នេយ៍ ដែលរីកធំឡើងច្រើនដងនៅរដូវវស្សា។ បង្កើនកម្រិតទឹកដើម្បីមើលទឹកជំនន់។",
    },
  },
  {
    id: "yeak-laom",
    name: "Yeak Laom Lake",
    region: "Ratanakiri",
    ...KH,
    lat: 13.7356,
    lon: 107.0119,
    sizeKm: 3,
    look: { style: "topo", lakes: true, exaggeration: 6 },
    story: {
      en: "An almost perfectly round lake in an old volcanic crater, ringed by forest.",
      km: "បឹងរាងមូលស្ទើរល្អឥតខ្ចោះ នៅក្នុងរណ្ដៅភ្នំភ្លើងចាស់ ព័ទ្ធជុំវិញដោយព្រៃឈើ។",
    },
  },
  {
    id: "kep",
    name: "Kep",
    region: "Kep",
    ...KH,
    lat: 10.483,
    lon: 104.317,
    sizeKm: 8,
    look: { style: "drawing", water: true },
    story: {
      en: "A seaside town known for its crab market, below the forested hills of Kep National Park.",
      km: "ក្រុងមាត់សមុទ្រល្បីដោយផ្សារក្ដាម នៅក្រោមភ្នំព្រៃឈើនៃឧទ្យានជាតិកែប។",
    },
  },
];

export const EXPLORE_WORLD: ExplorePlace[] = [
  {
    id: "everest",
    name: "Mount Everest",
    region: "Khumbu",
    country: "Nepal",
    countryCode: "NP",
    lat: 27.9881,
    lon: 86.925,
    sizeKm: 16,
    look: { style: "elevation", palette: "alpine", snow: 0.55, pin: true },
    story: {
      en: "The highest mountain on Earth, 8,849 m above sea level.",
      km: "ភ្នំខ្ពស់ជាងគេលើផែនដី ៨.៨៤៩ ម៉ែត្រពីនីវ៉ូទឹកសមុទ្រ។",
    },
  },
  {
    id: "fuji",
    name: "Mount Fuji",
    region: "Shizuoka",
    country: "Japan",
    countryCode: "JP",
    lat: 35.3606,
    lon: 138.7274,
    sizeKm: 22,
    look: { style: "drawing", snow: 0.75 },
    story: {
      en: "Japan's highest peak, 3,776 m: an almost symmetrical volcanic cone.",
      km: "កំពូលភ្នំខ្ពស់ជាងគេនៅជប៉ុន ៣.៧៧៦ ម៉ែត្រ៖ កោណភ្នំភ្លើងដែលស្ទើរតែស៊ីមេទ្រី។",
    },
  },
  {
    id: "grand-canyon",
    name: "Grand Canyon",
    region: "Arizona",
    country: "United States",
    countryCode: "US",
    lat: 36.1069,
    lon: -112.1129,
    sizeKm: 20,
    look: { style: "elevation", palette: "desert", strata: true },
    story: {
      en: "Carved by the Colorado River, up to about 1.8 km deep.",
      km: "ឆ្លាក់ដោយទន្លេ Colorado ជ្រៅរហូតដល់ប្រហែល ១,៨ គីឡូម៉ែត្រ។",
    },
  },
  {
    id: "matterhorn",
    name: "Matterhorn",
    region: "Valais",
    country: "Switzerland",
    countryCode: "CH",
    lat: 45.9763,
    lon: 7.6586,
    sizeKm: 10,
    look: { style: "topo", basemap: "swisstopo", snow: 0.6 },
    story: {
      en: "The four-faced pyramid on the Swiss-Italian border, 4,478 m.",
      km: "ពីរ៉ាមីតមុខបួនលើព្រំដែនស្វីស-អ៊ីតាលី ៤.៤៧៨ ម៉ែត្រ។",
    },
  },
];

/** The settings a curated place opens with. */
export function explorePlate(place: ExplorePlace): Partial<PlateSettings> {
  return {
    name: place.name,
    region: place.region,
    country: place.country,
    countryCode: place.countryCode,
    lat: place.lat,
    lon: place.lon,
    sizeKm: place.sizeKm,
    // Reset what a previous place may have set, then apply this one's look.
    exaggeration: 0,
    snow: 0,
    flood: 0,
    route: "",
    markers: [],
    ...place.look,
  };
}

// ── Saved for offline ──

export interface SavedPlate {
  name: string;
  lat: number;
  lon: number;
  sizeKm: number;
  savedAt: number;
  /** The full settings, so the plate opens exactly as it was saved. */
  plate: Partial<PlateSettings>;
}

const SAVED_KEY = "teetangart.plate.saved";
/** The page and the service worker both use this cache name. */
export const OFFLINE_CACHE = "teetangart-offline-v1";

export function readSaved(): SavedPlate[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function writeSaved(list: SavedPlate[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // Storage full or blocked; the plate is still cached for this visit.
  }
}

/**
 * Downloads everything a plate needs into the offline cache: the elevation
 * tiles for both detail levels, and the map tiles for imagery or topo styles.
 * The service worker serves them from there when there is no connection.
 */
export async function cachePlateOffline(
  bounds: import("./geo").PlateBounds,
  cells: number[],
  basemap: import("./basemaps").Basemap | null,
  drapeSize: number,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const [{ coveringTiles, tileZoomFor, wrapTileX }, { tileUrl }, { tileUrlFor }] =
    await Promise.all([import("./geo"), import("./elevationCore"), import("./basemaps")]);
  const urls = new Set<string>();
  for (const count of cells) {
    const zoom = tileZoomFor(bounds, count, 15);
    for (const [x, y] of coveringTiles(bounds, zoom))
      urls.add(tileUrl(zoom, wrapTileX(x, zoom), y));
  }
  if (basemap) {
    const zoom = tileZoomFor(bounds, drapeSize, basemap.maxZoom);
    for (const [x, y] of coveringTiles(bounds, zoom)) {
      urls.add(tileUrlFor(basemap, zoom, wrapTileX(x, zoom), y));
    }
  }
  const cache = await caches.open(OFFLINE_CACHE);
  let done = 0;
  let saved = 0;
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const response = await fetch(url, { mode: "cors" });
        if (response.ok) {
          await cache.put(url, response);
          saved++;
        }
      } catch {
        // One missing tile leaves a gap; the rest still work offline.
      } finally {
        onProgress?.(++done, urls.size);
      }
    }),
  );
  if (!saved) throw new Error("Nothing could be saved");
  return saved;
}
