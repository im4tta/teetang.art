import type { Page, Request } from "@playwright/test";
import { writeArrayBuffer } from "geotiff";

/**
 * Stand-ins for the elevation servers the plate can use besides the worldwide
 * tiles: Copernicus (through our /api/dem proxy), USGS 3DEP and
 * OpenTopography. Each serves a mountain whose summit is at the given place,
 * with a different height from the worldwide mock so the tests can tell them
 * apart.
 */

export interface Mountain {
  lat: number;
  lon: number;
  peak: number;
}

/** Metres above sea level: a smooth cone on a 400 m plain. */
export function mountainAt({ lat, lon, peak }: Mountain, atLat: number, atLon: number): number {
  const km = Math.hypot(
    (atLon - lon) * 111.32 * Math.cos((lat * Math.PI) / 180),
    (atLat - lat) * 110.57,
  );
  return 400 + (peak - 400) * Math.exp(-((km / 3) ** 2));
}

/** A GeoTIFF of float32 heights over a lat/lon box (north-up). */
export function makeTiff(
  box: { west: number; east: number; south: number; north: number },
  width: number,
  height: number,
  mountain: Mountain,
): Buffer {
  const values = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    const lat = box.north - ((row + 0.5) / height) * (box.north - box.south);
    for (let col = 0; col < width; col++) {
      const lon = box.west + ((col + 0.5) / width) * (box.east - box.west);
      values[row * width + col] = mountainAt(mountain, lat, lon);
    }
  }
  const buffer = writeArrayBuffer(values, {
    width,
    height,
    GeographicTypeGeoKey: 4326,
    ModelPixelScale: [(box.east - box.west) / width, (box.north - box.south) / height, 0],
    ModelTiepoint: [0, 0, 0, box.west, box.north, 0],
    SamplesPerPixel: 1,
    BitsPerSample: [32],
    SampleFormat: [3],
  } as never);
  return Buffer.from(buffer as ArrayBuffer);
}

export const SUMMIT = { lat: 12.0333, lon: 104.1667 };
/** Taller than the worldwide mock's 1,500 m, so a plate built from it stands out. */
export const COPERNICUS_PEAK = 2200;

/** One-degree Copernicus tiles around the default plate, served with byte ranges. */
export async function serveCopernicus(
  page: Page,
  // Change `status` during a test to make the proxy fail, then recover.
  control: { status?: number } = {},
): Promise<Request[]> {
  const seen: Request[] = [];
  const mountain = { ...SUMMIT, peak: COPERNICUS_PEAK };
  const cache = new Map<string, Buffer>();
  await page.route(/\/api\/dem\?/, (route) => {
    seen.push(route.request());
    if (control.status) return route.fulfill({ status: control.status, body: "nope" });
    const tile = new URL(route.request().url()).searchParams.get("tile") ?? "";
    const m = /^([NS])(\d{2})([EW])(\d{3})$/.exec(tile);
    if (!m) return route.fulfill({ status: 400 });
    const lat = (m[1] === "S" ? -1 : 1) * Number(m[2]);
    const lon = (m[3] === "W" ? -1 : 1) * Number(m[4]);
    // Only the tiles next to the summit exist; anywhere else is open sea.
    if (lat < 11 || lat > 12 || lon !== 104) {
      return route.fulfill({ status: 404, headers: { "x-dem": "missing" } });
    }
    let body = cache.get(tile);
    if (!body) {
      body = makeTiff({ west: lon, east: lon + 1, south: lat, north: lat + 1 }, 240, 240, mountain);
      cache.set(tile, body);
    }
    const range = /bytes=(\d+)-(\d+)/.exec(route.request().headers()["range"] ?? "");
    if (!range) return route.fulfill({ status: 416 });
    const from = Number(range[1]);
    const to = Math.min(body.length - 1, Number(range[2]));
    return route.fulfill({
      status: 206,
      body: body.subarray(from, to + 1),
      headers: {
        "content-type": "image/tiff",
        "content-range": `bytes ${from}-${to}/${body.length}`,
        "accept-ranges": "bytes",
      },
    });
  });
  return seen;
}

/** USGS 3DEP's image server: answers with a GeoTIFF over the requested box. */
export async function serve3dep(page: Page, mountain: Mountain): Promise<Request[]> {
  const seen: Request[] = [];
  await page.route(/elevation\.nationalmap\.gov\/.*exportImage/, (route) => {
    seen.push(route.request());
    const params = new URL(route.request().url()).searchParams;
    const [west, south, east, north] = params.get("bbox")!.split(",").map(Number);
    const [width, height] = params.get("size")!.split(",").map(Number);
    return route.fulfill({
      body: makeTiff({ west, east, south, north }, width, height, mountain),
      contentType: "image/tiff",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return seen;
}

/** OpenTopography's global DEM API, for any dataset. */
export async function serveOpenTopography(page: Page, mountain: Mountain): Promise<Request[]> {
  const seen: Request[] = [];
  await page.route(/portal\.opentopography\.org\/API\/globaldem/, (route) => {
    seen.push(route.request());
    const params = new URL(route.request().url()).searchParams;
    const box = {
      west: Number(params.get("west")),
      east: Number(params.get("east")),
      south: Number(params.get("south")),
      north: Number(params.get("north")),
    };
    return route.fulfill({
      body: makeTiff(box, 220, 220, mountain),
      contentType: "image/tiff",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return seen;
}
