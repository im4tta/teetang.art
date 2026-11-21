/**
 * Raster maps that can be laid over the terrain. Imagery goes with the
 * Satellite style, topographic and relief maps with the Topo style.
 *
 * teetang.art is a free, non-commercial project, which is what several of
 * these sources ask for. Every source here sends CORS headers, which the
 * browser needs before it can paint a tile onto the 3D plate.
 */

export type BasemapKind = "imagery" | "topo";

export interface Basemap {
  id: string;
  kind: BasemapKind;
  name: string;
  /** {z} {x} {y}, and {s} for a subdomain. */
  url: string;
  subdomains?: string[];
  maxZoom: number;
  credit: string;
  /** Where the map has data: west, south, east, north. Omitted for worldwide maps. */
  coverage?: [number, number, number, number];
  /** Short note shown under the name, e.g. the country it covers. */
  region?: string;
  /** A picture of one chosen day: the URL has {time} for the date. */
  daily?: boolean;
}

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
const esri = (service: string) => `${ESRI}/${service}/MapServer/tile/{z}/{y}/{x}`;
const USGS = "https://basemap.nationalmap.gov/arcgis/rest/services";
const ign = (layer: string, format: string) =>
  `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=${format}`;

const US: Basemap["coverage"] = [-170, 17, -64, 72];
const SWITZERLAND: Basemap["coverage"] = [5.9, 45.8, 10.5, 47.9];
const FRANCE: Basemap["coverage"] = [-5.2, 41.3, 9.6, 51.1];
const JAPAN: Basemap["coverage"] = [122, 24, 154, 46];
const NORWAY: Basemap["coverage"] = [4, 57.9, 31.2, 71.2];

export const BASEMAPS: Basemap[] = [
  // ── Imagery ──
  {
    id: "s2",
    kind: "imagery",
    name: "Sentinel-2",
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
    // Sentinel-2 pixels are 10 m; zoom 14 already matches them.
    maxZoom: 14,
    credit:
      "Sentinel-2 cloudless (s2maps.eu) by EOX IT Services GmbH · modified Copernicus Sentinel data 2020",
  },
  {
    id: "esri-imagery",
    kind: "imagery",
    name: "Esri World Imagery",
    url: esri("World_Imagery"),
    maxZoom: 18,
    credit: "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  },
  {
    id: "bluemarble",
    kind: "imagery",
    name: "NASA Blue Marble",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    maxZoom: 8,
    credit: "NASA Earth Observatory · Blue Marble via NASA GIBS",
    region: "Best for big areas",
  },
  {
    id: "modis-daily",
    kind: "imagery",
    name: "NASA by date",
    url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    maxZoom: 9,
    credit: "NASA EOSDIS GIBS · MODIS Terra corrected reflectance",
    region: "Any day since 2000 · best for 20 km and up",
    daily: true,
  },
  {
    id: "usgs-imagery",
    kind: "imagery",
    name: "USGS Imagery",
    url: `${USGS}/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`,
    maxZoom: 16,
    credit: "USGS The National Map",
    coverage: US,
    region: "United States",
  },
  {
    id: "swissimage",
    kind: "imagery",
    name: "SWISSIMAGE",
    url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg",
    maxZoom: 19,
    credit: "© swisstopo",
    coverage: SWITZERLAND,
    region: "Switzerland",
  },
  {
    id: "ign-ortho",
    kind: "imagery",
    name: "IGN Ortho",
    url: ign("ORTHOIMAGERY.ORTHOPHOTOS", "image/jpeg"),
    maxZoom: 19,
    credit: "© IGN – Géoplateforme",
    coverage: FRANCE,
    region: "France",
  },
  {
    id: "gsi-photo",
    kind: "imagery",
    name: "GSI Photo",
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    maxZoom: 18,
    credit: "地理院タイル (GSI Japan)",
    coverage: JAPAN,
    region: "Japan",
  },

  // ── Topographic and relief ──
  {
    id: "opentopo",
    kind: "topo",
    name: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 17,
    credit: "© OpenTopoMap (CC-BY-SA) · © OpenStreetMap contributors · SRTM",
  },
  {
    id: "esri-topo",
    kind: "topo",
    name: "Esri Topographic",
    url: esri("World_Topo_Map"),
    maxZoom: 18,
    credit: "Esri, HERE, Garmin, USGS, NGA, and the GIS User Community",
  },
  {
    id: "natgeo",
    kind: "topo",
    name: "National Geographic",
    url: esri("NatGeo_World_Map"),
    maxZoom: 16,
    credit:
      "National Geographic, Esri, Garmin, HERE, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA",
  },
  {
    id: "hillshade",
    kind: "topo",
    name: "Hillshade",
    url: "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 16,
    credit: "Esri, USGS, NGA, NASA, CGIAR, N Robinson, NCEAS, NLS, OS, NMA, Geodatastyrelsen",
  },
  {
    id: "shaded-relief",
    kind: "topo",
    name: "Shaded Relief",
    url: esri("World_Shaded_Relief"),
    maxZoom: 13,
    credit: "Esri, USGS, NOAA",
  },
  {
    id: "terrain-base",
    kind: "topo",
    name: "Terrain Base",
    url: esri("World_Terrain_Base"),
    maxZoom: 13,
    credit: "Esri, USGS, NOAA",
  },
  {
    id: "cyclosm",
    kind: "topo",
    name: "CyclOSM",
    url: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 18,
    credit: "CyclOSM · © OpenStreetMap contributors",
  },
  {
    id: "osm",
    kind: "topo",
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 18,
    credit: "© OpenStreetMap contributors",
  },
  {
    id: "osm-hot",
    kind: "topo",
    name: "Humanitarian",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    maxZoom: 18,
    credit: "Humanitarian OpenStreetMap Team · © OpenStreetMap contributors",
  },
  {
    id: "topplus",
    kind: "topo",
    name: "TopPlusOpen",
    url: "https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png",
    maxZoom: 18,
    credit: "© BKG (dl-de/by-2-0)",
    region: "Detailed in Europe",
  },
  {
    id: "usgs-topo",
    kind: "topo",
    name: "USGS Topo",
    url: `${USGS}/USGSTopo/MapServer/tile/{z}/{y}/{x}`,
    maxZoom: 16,
    credit: "USGS The National Map",
    coverage: US,
    region: "United States",
  },
  {
    id: "swisstopo",
    kind: "topo",
    name: "swisstopo",
    url: "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    maxZoom: 18,
    credit: "© swisstopo",
    coverage: SWITZERLAND,
    region: "Switzerland",
  },
  {
    id: "ign-plan",
    kind: "topo",
    name: "IGN Plan",
    url: ign("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "image/png"),
    maxZoom: 18,
    credit: "© IGN – Géoplateforme",
    coverage: FRANCE,
    region: "France",
  },
  {
    id: "gsi-std",
    kind: "topo",
    name: "GSI Standard",
    url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    maxZoom: 18,
    credit: "地理院タイル (GSI Japan)",
    coverage: JAPAN,
    region: "Japan",
  },
  {
    id: "gsi-relief",
    kind: "topo",
    name: "GSI Colour Relief",
    url: "https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png",
    maxZoom: 15,
    credit: "地理院タイル (GSI Japan)",
    coverage: JAPAN,
    region: "Japan",
  },
  {
    id: "kartverket",
    kind: "topo",
    name: "Kartverket Topo",
    url: "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
    maxZoom: 18,
    credit: "© Kartverket",
    coverage: NORWAY,
    region: "Norway",
  },
];

export const DEFAULT_BASEMAP: Record<BasemapKind, string> = {
  imagery: "s2",
  topo: "opentopo",
};

export const basemapById = (id: string) => BASEMAPS.find((map) => map.id === id);

/** Whether the map has data at this point. */
export function covers(map: Basemap, lat: number, lon: number): boolean {
  if (!map.coverage) return true;
  const [west, south, east, north] = map.coverage;
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

/** The map to use for a style: the chosen one if it fits the style and the place, else the default. */
export function resolveBasemap(kind: BasemapKind, id: string, lat: number, lon: number): Basemap {
  const chosen = basemapById(id);
  if (chosen && chosen.kind === kind && covers(chosen, lat, lon)) return chosen;
  return basemapById(DEFAULT_BASEMAP[kind])!;
}

/** Three days ago, in UTC: recent enough to be interesting, old enough to be complete. */
export function recentDay(): string {
  return new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
}

export function tileUrlFor(map: Basemap, z: number, x: number, y: number, day = ""): string {
  const subdomain = map.subdomains ? map.subdomains[(x + y) % map.subdomains.length] : "";
  return map.url
    .replace("{s}", subdomain)
    .replace("{time}", day || recentDay())
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}
