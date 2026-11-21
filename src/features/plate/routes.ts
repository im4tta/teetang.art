/**
 * Routes and markers on the plate: importing a track (GPX, GeoJSON, KML),
 * keeping it short enough for a share link, drawing it on the terrain,
 * raising it in the print and working out its elevation profile.
 */
import type { HeightGrid } from "./elevationCore";
import { latToY, lonToX, plateBounds, type PlateBounds } from "./geo";

export type LatLon = [number, number];

export interface PlateMarker {
  lat: number;
  lon: number;
  label: string;
  /** A photo kept on this device (see photos.ts); not part of share links. */
  photo?: string;
}

export const MAX_MARKERS = 12;
/** Points kept after simplifying, so a route fits in a share link. */
const MAX_ROUTE_POINTS = 400;

// ── Reading tracks ──

/** Reads a GPX, KML or GeoJSON file into one list of points. */
export function parseTrack(text: string): { name: string; points: LatLon[] } {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return parseGeoJson(JSON.parse(trimmed));
  const doc = new DOMParser().parseFromString(trimmed, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Not a GPX, KML or GeoJSON file");
  const name =
    doc
      .querySelector("trk > name, rte > name, metadata > name, Document > name, Placemark > name")
      ?.textContent?.trim() ?? "";
  // GPX: track points, then route points, then waypoints.
  for (const selector of ["trkpt", "rtept", "wpt"]) {
    const nodes = [...doc.getElementsByTagName(selector)];
    if (nodes.length > 1) {
      const points = nodes
        .map(
          (node) => [Number(node.getAttribute("lat")), Number(node.getAttribute("lon"))] as LatLon,
        )
        .filter(isLatLon);
      if (points.length > 1) return { name, points };
    }
  }
  // KML: "lon,lat[,alt]" tuples in <coordinates>.
  const points: LatLon[] = [];
  for (const node of doc.getElementsByTagName("coordinates")) {
    for (const tuple of (node.textContent ?? "").trim().split(/\s+/)) {
      const [lon, lat] = tuple.split(",").map(Number);
      if (isLatLon([lat, lon])) points.push([lat, lon]);
    }
  }
  if (points.length > 1) return { name, points };
  throw new Error("No track found in this file");
}

function parseGeoJson(json: unknown): { name: string; points: LatLon[] } {
  const points: LatLon[] = [];
  let name = "";
  const visit = (node: Record<string, unknown> | null | undefined) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "FeatureCollection")
      (node.features as Record<string, unknown>[]).forEach(visit);
    else if (node.type === "Feature") {
      name ||= String((node.properties as Record<string, unknown> | null)?.name ?? "");
      visit(node.geometry as Record<string, unknown>);
    } else if (node.type === "LineString") {
      for (const [lon, lat] of node.coordinates as number[][]) points.push([lat, lon]);
    } else if (node.type === "MultiLineString") {
      for (const line of node.coordinates as number[][][]) {
        for (const [lon, lat] of line) points.push([lat, lon]);
      }
    }
  };
  visit(json as Record<string, unknown>);
  const valid = points.filter(isLatLon);
  if (valid.length < 2) throw new Error("No line found in this GeoJSON");
  return { name, points: valid };
}

const isLatLon = ([lat, lon]: LatLon) =>
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180;

// ── Distances and simplifying ──

const EARTH_RADIUS_M = 6_371_000;
export function distanceMetres([lat1, lon1]: LatLon, [lat2, lon2]: LatLon): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Douglas–Peucker in Web Mercator, loosened until the route has at most `max` points. */
export function simplifyRoute(points: LatLon[], max = MAX_ROUTE_POINTS): LatLon[] {
  if (points.length <= max) return points;
  const xy = points.map(([lat, lon]) => [lonToX(lon), latToY(lat)]);
  const span = Math.max(
    Math.max(...xy.map((p) => p[0])) - Math.min(...xy.map((p) => p[0])),
    Math.max(...xy.map((p) => p[1])) - Math.min(...xy.map((p) => p[1])),
  );
  let tolerance = span / 4000;
  let kept = points;
  while (kept.length > max) {
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack: [number, number][] = [[0, points.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      let worst = -1;
      let index = -1;
      const [ax, ay] = xy[a];
      const [bx, by] = xy[b];
      const length = Math.hypot(bx - ax, by - ay) || 1e-12;
      for (let k = a + 1; k < b; k++) {
        const d = Math.abs((bx - ax) * (ay - xy[k][1]) - (ax - xy[k][0]) * (by - ay)) / length;
        if (d > worst) {
          worst = d;
          index = k;
        }
      }
      if (worst > tolerance) {
        keep[index] = 1;
        stack.push([a, index], [index, b]);
      }
    }
    kept = points.filter((_, k) => keep[k]);
    tolerance *= 1.6;
  }
  return kept;
}

// ── Share links: Google's encoded polyline, 5 decimal places ──

export function encodeRoute(points: LatLon[]): string {
  let last = [0, 0];
  let out = "";
  for (const point of points) {
    const now = [Math.round(point[0] * 1e5), Math.round(point[1] * 1e5)];
    for (const k of [0, 1]) {
      let value = now[k] - last[k];
      value = value < 0 ? ~(value << 1) : value << 1;
      while (value >= 0x20) {
        out += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
        value >>= 5;
      }
      out += String.fromCharCode(value + 63);
    }
    last = now;
  }
  return out;
}

export function decodeRoute(encoded: string): LatLon[] {
  const points: LatLon[] = [];
  let index = 0;
  const now = [0, 0];
  while (index < encoded.length) {
    for (const k of [0, 1]) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      now[k] += result & 1 ? ~(result >> 1) : result >> 1;
    }
    points.push([now[0] / 1e5, now[1] / 1e5]);
  }
  return points.filter(isLatLon);
}

/** One or more tracks (days of a trip), encoded polylines separated by spaces. */
export const isEncodedRoute = (value: string) => /^[\x3f-\x7e ]{0,8000}$/.test(value);

export function decodeTracks(encoded: string): LatLon[][] {
  return encoded
    .split(" ")
    .filter(Boolean)
    .map(decodeRoute)
    .filter((track) => track.length > 1);
}

export function encodeTracks(tracks: LatLon[][]): string {
  return tracks.map(encodeRoute).join(" ");
}

/** Tracks after the first take these colours in turn, so each day stands apart. */
const DAY_COLORS = ["#1971c2", "#2f9e44", "#f08c00", "#d6336c", "#7048e8"];
export const trackColor = (index: number, first: string) =>
  index === 0 ? first : DAY_COLORS[(index - 1) % DAY_COLORS.length];

/** Points kept per track when a trip has several days, so the link stays short. */
export const pointsPerTrack = (days: number) => Math.max(80, Math.floor(MAX_ROUTE_POINTS / days));

// ── Placing on the plate ──

/** Plate texture coordinates (0..1, north at v = 0) of a point. */
export function toPlateUv(bounds: PlateBounds, [lat, lon]: LatLon): [number, number] {
  return [
    (lonToX(lon) - bounds.x0) / (bounds.x1 - bounds.x0),
    (latToY(lat) - bounds.y0) / (bounds.y1 - bounds.y0),
  ];
}

/** A square around the route with a margin, sized in round kilometres. */
export function fitRoute(points: LatLon[]): { lat: number; lon: number; sizeKm: number } {
  const xs = points.map(([, lon]) => lonToX(lon));
  const ys = points.map(([lat]) => latToY(lat));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180) / Math.PI;
  const lon = cx * 360 - 180;
  // Mercator span to ground distance at the centre's latitude.
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const km = span * 40_075.016686 * Math.cos((lat * Math.PI) / 180) * 1.3;
  const sizeKm = Math.min(100, Math.max(0.5, km < 2 ? Math.ceil(km * 10) / 10 : Math.ceil(km)));
  return { lat, lon, sizeKm };
}

/** Whether a point falls on the plate's square. */
export function onPlate(bounds: PlateBounds, point: LatLon): boolean {
  const [u, v] = toPlateUv(bounds, point);
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

export interface OverlayOptions {
  /** Each day of a trip; the first takes `color`, the rest their own colours. */
  tracks: LatLon[][];
  markers: PlateMarker[];
  color: string;
  /** Marker dots and their labels. */
  ink: string;
  paper: string;
  /** A measuring line, drawn dashed. */
  line?: LatLon[];
  /** Roads: white on black over the plate's square, drawn first in the ink colour. */
  roads?: HTMLCanvasElement | null;
  size?: number;
}

/** The route and marker dots, drawn in plate texture space with transparency. */
export function drawOverlay(bounds: PlateBounds, options: OverlayOptions): HTMLCanvasElement {
  const size = options.size ?? 2048;
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const ctx = canvas.getContext("2d")!;
  if (options.roads) {
    ctx.globalAlpha = 0.7;
    ctx.drawImage(tintMask(options.roads, options.ink), 0, 0, size, size);
    ctx.globalAlpha = 1;
  }
  const at = (point: LatLon) =>
    toPlateUv(bounds, point).map((value) => value * size) as [number, number];
  options.tracks.forEach((track, index) => {
    if (track.length < 2) return;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // A pale casing keeps the line readable on dark imagery.
    for (const [color, width] of [
      [options.paper, size * 0.009],
      [trackColor(index, options.color), size * 0.0055],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      track.forEach((point, k) => (k ? ctx.lineTo(...at(point)) : ctx.moveTo(...at(point))));
      ctx.stroke();
    }
    // Start and finish.
    const ends: [LatLon, string][] = [
      [track[0], "#2f9e44"],
      [track[track.length - 1], "#c92a2a"],
    ];
    for (const [point, color] of ends) {
      const [x, y] = at(point);
      ctx.fillStyle = options.paper;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.009, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.006, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  if (options.line && options.line.length > 1) {
    ctx.setLineDash([size * 0.012, size * 0.008]);
    ctx.lineCap = "round";
    for (const [color, width] of [
      [options.paper, size * 0.007],
      [options.ink, size * 0.0035],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      options.line.forEach((point, k) => (k ? ctx.lineTo(...at(point)) : ctx.moveTo(...at(point))));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  for (const marker of options.markers) {
    const [x, y] = at([marker.lat, marker.lon]);
    ctx.fillStyle = options.paper;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.008, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = options.ink;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.005, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

/**
 * How much each grid vertex sits on the route (0..1), for raising it into a
 * ridge the printer can feel. Anti-aliased, so the ridge has sloped sides.
 */
export function routeMask(bounds: PlateBounds, tracks: LatLon[][], gridSize: number): Float32Array {
  const mask = new Float32Array(gridSize * gridSize);
  if (!tracks.some((track) => track.length > 1)) return mask;
  const canvas = Object.assign(document.createElement("canvas"), {
    width: gridSize,
    height: gridSize,
  });
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const scale = gridSize - 1;
  ctx.strokeStyle = "#fff";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // About 1.2% of the plate's width: 1.2 mm on a 10 cm print.
  ctx.lineWidth = Math.max(1.5, gridSize * 0.012);
  for (const track of tracks) {
    ctx.beginPath();
    track.forEach((point, k) => {
      const [u, v] = toPlateUv(bounds, point);
      // Pixel centres sit on grid vertices.
      const x = u * scale + 0.5;
      const y = v * scale + 0.5;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  const { data } = ctx.getImageData(0, 0, gridSize, gridSize);
  for (let k = 0; k < mask.length; k++) mask[k] = data[k * 4 + 3] / 255;
  return mask;
}

// ── Elevation profile ──

export interface Profile {
  /** Distance from the start in metres, and elevation in metres, per sample. */
  distances: number[];
  elevations: number[];
  length: number;
  ascent: number;
  descent: number;
  min: number;
  max: number;
}

function sampleGrid(grid: HeightGrid, u: number, v: number): number {
  const last = grid.size - 1;
  const fx = Math.min(last, Math.max(0, u * last));
  const fy = Math.min(last, Math.max(0, v * last));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(last, x0 + 1);
  const y1 = Math.min(last, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const h = grid.heights;
  const s = grid.size;
  const top = h[y0 * s + x0] * (1 - tx) + h[y0 * s + x1] * tx;
  const bottom = h[y1 * s + x0] * (1 - tx) + h[y1 * s + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/** Samples the terrain along a line every few metres; only the part on the plate counts. */
export function elevationProfile(
  grid: HeightGrid,
  bounds: PlateBounds,
  points: LatLon[],
  samples = 240,
): Profile | null {
  const legs: number[] = [0];
  for (let k = 1; k < points.length; k++) {
    legs.push(legs[k - 1] + distanceMetres(points[k - 1], points[k]));
  }
  const total = legs[legs.length - 1];
  if (total <= 0) return null;
  const distances: number[] = [];
  const elevations: number[] = [];
  let leg = 1;
  for (let k = 0; k <= samples; k++) {
    const d = (total * k) / samples;
    while (leg < legs.length - 1 && legs[leg] < d) leg++;
    const t = (d - legs[leg - 1]) / Math.max(1e-9, legs[leg] - legs[leg - 1]);
    const a = points[leg - 1];
    const b = points[leg];
    const point: LatLon = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (!onPlate(bounds, point)) continue;
    const [u, v] = toPlateUv(bounds, point);
    distances.push(d);
    elevations.push(sampleGrid(grid, u, v));
  }
  if (elevations.length < 2) return null;
  let ascent = 0;
  let descent = 0;
  // Ignore wiggles under 2 m, which are noise in the elevation data.
  let reference = elevations[0];
  for (const h of elevations) {
    if (h - reference > 2) {
      ascent += h - reference;
      reference = h;
    } else if (reference - h > 2) {
      descent += reference - h;
      reference = h;
    }
  }
  return {
    distances,
    elevations,
    length: distances[distances.length - 1] - distances[0],
    ascent,
    descent,
    min: Math.min(...elevations),
    max: Math.max(...elevations),
  };
}

/** The profile as a standalone SVG chart, for the profile panel and its download. */
export function profileSvg(
  profile: Profile,
  { ink, paper, accent, title }: { ink: string; paper: string; accent: string; title: string },
): string {
  const width = 900;
  const height = 320;
  const pad = { left: 96, right: 24, top: 56, bottom: 50 };
  const span = Math.max(1, profile.max - profile.min);
  const low = profile.min - span * 0.08;
  const high = profile.max + span * 0.08;
  const x = (d: number) =>
    pad.left +
    ((d - profile.distances[0]) / Math.max(1, profile.length)) * (width - pad.left - pad.right);
  const y = (h: number) =>
    pad.top + (1 - (h - low) / (high - low)) * (height - pad.top - pad.bottom);
  const line = profile.distances
    .map((d, k) => `${k ? "L" : "M"}${x(d).toFixed(1)} ${y(profile.elevations[k]).toFixed(1)}`)
    .join("");
  const baseline = height - pad.bottom;
  const area = `${line}L${x(profile.distances[profile.distances.length - 1]).toFixed(1)} ${baseline}L${x(profile.distances[0]).toFixed(1)} ${baseline}Z`;
  const km = profile.length / 1000;
  const ticks = [low + (high - low) * 0.1, (low + high) / 2, high - (high - low) * 0.1];
  const escape = (text: string) => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const fmt = (metres: number) => `${Math.round(metres).toLocaleString("en-US")} m`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="'JetBrains Mono', ui-monospace, monospace">`,
    `<rect width="100%" height="100%" fill="${paper}"/>`,
    `<text x="${pad.left}" y="28" font-size="24" fill="${ink}" font-weight="600">${escape(title)}</text>`,
    `<text x="${width - pad.right}" y="28" font-size="20" fill="${ink}" text-anchor="end" opacity="0.75">${km.toFixed(km < 10 ? 2 : 1)} km · ↑ ${fmt(profile.ascent)} · ↓ ${fmt(profile.descent)}</text>`,
    ...ticks.map(
      (h) =>
        `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(h).toFixed(1)}" y2="${y(h).toFixed(1)}" stroke="${ink}" stroke-opacity="0.12"/>` +
        `<text x="${pad.left - 8}" y="${(y(h) + 4).toFixed(1)}" font-size="17" fill="${ink}" text-anchor="end" opacity="0.7">${fmt(h)}</text>`,
    ),
    `<path d="${area}" fill="${accent}" fill-opacity="0.18"/>`,
    `<path d="${line}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/>`,
    `<text x="${pad.left}" y="${height - 16}" font-size="17" fill="${ink}" opacity="0.7">0 km</text>`,
    `<text x="${width - pad.right}" y="${height - 16}" font-size="17" fill="${ink}" text-anchor="end" opacity="0.7">${km.toFixed(km < 10 ? 2 : 1)} km</text>`,
    `</svg>`,
  ].join("\n");
}

/** Bounds of a plate from its settings; re-exported for callers that only import this module. */
export { plateBounds };

/** A white-on-black mask turned into `color` with the mask as transparency. */
function tintMask(mask: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const canvas = Object.assign(document.createElement("canvas"), {
    width: mask.width,
    height: mask.height,
  });
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(mask, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(color.slice(k, k + 2), 16));
  const data = image.data;
  for (let k = 0; k < data.length; k += 4) {
    const alpha = data[k];
    data[k] = r;
    data[k + 1] = g;
    data[k + 2] = b;
    data[k + 3] = alpha;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
