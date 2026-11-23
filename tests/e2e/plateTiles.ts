import { deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";

/**
 * Synthetic tiles for the 3D plate tests, so they run offline and the terrain
 * is known: a single mountain whose summit sits at the default plate's centre.
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** An RGB PNG of 256×256 pixels from a colour function. */
function png(pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const size = 256;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), row + 1 + x * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const SUMMIT_METRES = 1500;
const SUMMIT = { lon: 104.1667, lat: 12.0333 };

function worldXY(z: number, tx: number, ty: number, px: number, py: number) {
  const n = 2 ** z * 256;
  return [(tx * 256 + px + 0.5) / n, (ty * 256 + py + 0.5) / n];
}

const summitX = (SUMMIT.lon + 180) / 360;
const summitY = (() => {
  const s = Math.sin((SUMMIT.lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
})();

function elevationTile(z: number, x: number, y: number): Buffer {
  return png((px, py) => {
    const [wx, wy] = worldXY(z, x, y, px, py);
    // Distance from the summit in kilometres (good enough near the equator).
    const km = Math.hypot(wx - summitX, wy - summitY) * 40_075;
    const metres = 200 + (SUMMIT_METRES - 200) * Math.exp(-((km / 3) ** 2));
    const value = metres + 32768;
    return [Math.floor(value / 256), Math.floor(value) % 256, Math.round((value % 1) * 256) % 256];
  });
}

/** A map tile that is red north of the summit's latitude and blue south of it. */
export function splitTile(z: number, y: number): Buffer {
  return png((_, py) =>
    (y * 256 + py + 0.5) / (2 ** z * 256) < summitY ? [220, 30, 30] : [30, 30, 220],
  );
}

const satelliteTile = png((x, y) => [40 + (x >> 2), 120, 60 + (y >> 2)]);

/** Serves elevation (and optionally satellite) tiles; everything else stays blocked. */
export async function serveTiles(page: Page, { satellite = true } = {}) {
  await page.route(/elevation-tiles-prod\/terrarium\/(\d+)\/(\d+)\/(\d+)\.png$/, (route) => {
    const [, z, x, y] = route
      .request()
      .url()
      .match(/(\d+)\/(\d+)\/(\d+)\.png$/)!
      .map(Number);
    return route.fulfill({
      body: elevationTile(z, x, y),
      contentType: "image/png",
      headers: {
        "access-control-allow-origin": "*",
        // Like the real bucket: which source files the tile was cut from.
        "access-control-expose-headers": "x-amz-meta-x-imagery-sources",
        "x-amz-meta-x-imagery-sources": "srtm/N12E104.tif",
      },
    });
  });
  if (satellite) {
    await page.route(/tiles\.maps\.eox\.at/, (route) =>
      route.fulfill({
        body: satelliteTile,
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" },
      }),
    );
  }
}
