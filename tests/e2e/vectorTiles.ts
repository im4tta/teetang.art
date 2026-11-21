import type { Page } from "@playwright/test";

/**
 * A minimal Mapbox Vector Tile encoder for the tests: one "building" layer
 * with a square footprint, so the plate's OpenStreetMap features can be
 * tested offline. Spec: https://github.com/mapbox/vector-tile-spec
 */

const varint = (value: number): number[] => {
  const out: number[] = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return out;
};
const zigzag = (n: number) => (n << 1) ^ (n >> 31);
const field = (number: number, wire: number) => varint((number << 3) | wire);
const bytes = (number: number, data: number[]) => [
  ...field(number, 2),
  ...varint(data.length),
  ...data,
];
const text = (number: number, value: string) => bytes(number, [...Buffer.from(value, "utf8")]);
const uint = (number: number, value: number) => [...field(number, 0), ...varint(value)];

/** A closed square polygon in tile coordinates (0..4096). */
function squareGeometry(x0: number, y0: number, x1: number, y1: number): number[] {
  const command = (id: number, count: number) => (id & 0x7) | (count << 3);
  return [
    command(1, 1),
    zigzag(x0),
    zigzag(y0),
    command(2, 3),
    zigzag(x1 - x0),
    zigzag(0),
    zigzag(0),
    zigzag(y1 - y0),
    zigzag(x0 - x1),
    zigzag(0),
    command(7, 1),
  ];
}

function buildingTile(square: [number, number, number, number], heightMetres: number): Buffer {
  const geometry = squareGeometry(...square);
  const feature = [
    ...uint(1, 1),
    ...bytes(2, [...varint(0), ...varint(0)]),
    ...uint(3, 3),
    ...bytes(
      4,
      geometry.flatMap((value) => varint(value)),
    ),
  ];
  // Value message: int_value (field 4).
  const value = [...uint(4, heightMetres)];
  const layer = [
    ...uint(15, 2),
    ...text(1, "building"),
    ...bytes(2, feature),
    ...text(3, "render_height"),
    ...bytes(4, value),
    ...uint(5, 4096),
  ];
  return Buffer.from(bytes(3, layer));
}

/**
 * Serves OpenFreeMap's TileJSON and tiles: every tile at or above zoom 12
 * whose area holds `lat, lon` gets one building there; other tiles are empty.
 */
export async function serveBuilding(page: Page, lat: number, lon: number, heightMetres: number) {
  await page.route("https://tiles.openfreemap.org/planet", (route) =>
    route.fulfill({
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        tilejson: "3.0.0",
        tiles: ["https://tiles.openfreemap.org/test/{z}/{x}/{y}.pbf"],
        minzoom: 0,
        maxzoom: 14,
      }),
    }),
  );
  await page.route(/tiles\.openfreemap\.org\/test\/(\d+)\/(\d+)\/(\d+)\.pbf/, (route) => {
    const [, z, x, y] = route
      .request()
      .url()
      .match(/(\d+)\/(\d+)\/(\d+)\.pbf/)!
      .map(Number);
    const n = 2 ** z;
    const s = Math.sin((lat * Math.PI) / 180);
    const wx = ((lon + 180) / 360) * n - x;
    const wy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n - y;
    const inside = z >= 12 && wx >= 0 && wx < 1 && wy >= 0 && wy < 1;
    // About 200 m across at zoom 12.
    const half = 4096 * (0.0045 * 2 ** (z - 12));
    const cx = wx * 4096;
    const cy = wy * 4096;
    const body = inside
      ? buildingTile(
          [
            Math.round(cx - half),
            Math.round(cy - half),
            Math.round(cx + half),
            Math.round(cy + half),
          ],
          heightMetres,
        )
      : Buffer.alloc(0);
    return route.fulfill({
      contentType: "application/x-protobuf",
      headers: { "access-control-allow-origin": "*" },
      body,
    });
  });
}
