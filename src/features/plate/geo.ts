/** Web Mercator helpers for cutting a square plate out of the world. */

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const MAX_LAT = 85.0511;

export interface PlateBounds {
  /** Mercator world coordinates, 0..1 left to right and top to bottom. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  west: number;
  east: number;
  north: number;
  south: number;
  sizeMeters: number;
}

export const lonToX = (lon: number) => (lon + 180) / 360;

export function latToY(lat: number): number {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const s = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

export const xToLon = (x: number) => x * 360 - 180;
export const yToLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

/** A ground square of `sizeKm` on each side, centred on the given point. */
export function plateBounds(lat: number, lon: number, sizeKm: number): PlateBounds {
  const sizeMeters = sizeKm * 1000;
  const span = sizeMeters / (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180));
  const cx = lonToX(lon);
  const cy = latToY(lat);
  const x0 = cx - span / 2;
  const x1 = cx + span / 2;
  const y0 = cy - span / 2;
  const y1 = cy + span / 2;
  return {
    x0,
    y0,
    x1,
    y1,
    west: xToLon(x0),
    east: xToLon(x1),
    north: yToLat(y0),
    south: yToLat(y1),
    sizeMeters,
  };
}

/** Converts a position on the plate (u, v in 0..1) back to longitude and latitude. */
export function plateToLonLat(bounds: PlateBounds, u: number, v: number): [number, number] {
  return [
    xToLon(bounds.x0 + (bounds.x1 - bounds.x0) * u),
    yToLat(bounds.y0 + (bounds.y1 - bounds.y0) * v),
  ];
}

/** Lowest tile zoom whose pixels are at least as fine as `cells` across the plate. */
export function tileZoomFor(bounds: PlateBounds, cells: number, maxZoom: number): number {
  const span = bounds.x1 - bounds.x0;
  const zoom = Math.ceil(Math.log2(cells / (span * 256)));
  return Math.max(0, Math.min(maxZoom, zoom));
}

/** Tiles (x, y) at `zoom` that cover the bounds. */
export function coveringTiles(bounds: PlateBounds, zoom: number): [number, number][] {
  const n = 2 ** zoom;
  const tx0 = Math.floor(bounds.x0 * n);
  const tx1 = Math.floor(bounds.x1 * n);
  const ty0 = Math.max(0, Math.floor(bounds.y0 * n));
  const ty1 = Math.min(n - 1, Math.floor(bounds.y1 * n));
  const tiles: [number, number][] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) tiles.push([tx, ty]);
  }
  return tiles;
}

/** Wraps a tile column across the antimeridian. */
export const wrapTileX = (x: number, zoom: number) => {
  const n = 2 ** zoom;
  return ((x % n) + n) % n;
};
