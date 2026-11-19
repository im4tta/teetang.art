/**
 * The printable model: the terrain plus its extras as plain triangle lists,
 * checks a slicer would care about, and the STL and 3MF writers.
 *
 * Plate units are converted to millimetres here: x east, y north, z up, with
 * the base resting on z = 0, as slicers expect.
 */
import type { HeightGrid } from "./elevationCore";
import type { PlateExtras } from "./extras";
import type { PlateGeometry } from "./geometry";

export interface ModelPart {
  id: "terrain" | "label" | "pin" | "markers" | "water";
  /** Triangles in plate units (x, y up, z south), three corners each. */
  soup: Float32Array;
}

function indexedToSoup(positions: Float32Array, index: Uint32Array, extra?: Float32Array) {
  const soup = new Float32Array(index.length * 3 + (extra?.length ?? 0));
  for (let k = 0; k < index.length; k++) {
    const v = index[k] * 3;
    soup[k * 3] = positions[v];
    soup[k * 3 + 1] = positions[v + 1];
    soup[k * 3 + 2] = positions[v + 2];
  }
  if (extra) soup.set(extra, index.length * 3);
  return soup;
}

export function modelParts(geometry: PlateGeometry, extras?: PlateExtras | null): ModelPart[] {
  const parts: ModelPart[] = [
    {
      id: "terrain",
      soup: indexedToSoup(geometry.surface, geometry.surfaceIndex, geometry.shell),
    },
  ];
  if (extras?.label) {
    const { surface, index, shell } = extras.label;
    parts.push({ id: "label", soup: indexedToSoup(surface, index, shell) });
  }
  if (extras?.pin) parts.push({ id: "pin", soup: extras.pin.soup });
  if (extras?.markers.length) {
    const soup = new Float32Array(extras.markers.reduce((sum, m) => sum + m.soup.length, 0));
    let offset = 0;
    for (const marker of extras.markers) {
      soup.set(marker.soup, offset);
      offset += marker.soup.length;
    }
    parts.push({ id: "markers", soup });
  }
  return parts;
}

/** Plate (x, y up, z south) → print (x, y north, z up) in millimetres, base on z = 0. */
function toPrint(soup: Float32Array, widthMm: number, lift: number): Float32Array {
  const out = new Float32Array(soup.length);
  for (let k = 0; k < soup.length; k += 3) {
    out[k] = soup[k] * widthMm;
    out[k + 1] = -soup[k + 2] * widthMm;
    out[k + 2] = (soup[k + 1] + lift) * widthMm;
  }
  return out;
}

/** Each part in print millimetres. */
export function printSoups(parts: ModelPart[], widthMm: number, baseDepth: number) {
  return parts.map((part) => ({ id: part.id, soup: toPrint(part.soup, widthMm, baseDepth) }));
}

/** Binary STL with every part in one file; slicers merge overlapping solids. */
export function writeStl(soups: { soup: Float32Array }[], name = "teetang.art plate"): ArrayBuffer {
  const triangles = soups.reduce((sum, part) => sum + part.soup.length / 9, 0);
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  for (let k = 0; k < Math.min(80, name.length); k++) view.setUint8(k, name.charCodeAt(k) & 0x7f);
  view.setUint32(80, triangles, true);
  let offset = 84;
  for (const { soup } of soups) {
    for (let k = 0; k < soup.length; k += 9) {
      const ux = soup[k + 3] - soup[k],
        uy = soup[k + 4] - soup[k + 1],
        uz = soup[k + 5] - soup[k + 2];
      const vx = soup[k + 6] - soup[k],
        vy = soup[k + 7] - soup[k + 1],
        vz = soup[k + 8] - soup[k + 2];
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const length = Math.hypot(nx, ny, nz) || 1;
      nx /= length;
      ny /= length;
      nz /= length;
      view.setFloat32(offset, nx, true);
      view.setFloat32(offset + 4, ny, true);
      view.setFloat32(offset + 8, nz, true);
      for (let c = 0; c < 9; c++) view.setFloat32(offset + 12 + c * 4, soup[k + c], true);
      offset += 50;
    }
  }
  return buffer;
}

export interface IndexedMesh {
  vertices: Float32Array;
  triangles: Uint32Array;
}

/** Joins corners that share a position (to 1 µm), turning a triangle list into a mesh. */
export function weld(soup: Float32Array): IndexedMesh {
  const ids = new Map<string, number>();
  const vertices: number[] = [];
  const triangles = new Uint32Array(soup.length / 3);
  for (let k = 0; k < soup.length; k += 3) {
    const key = `${Math.round(soup[k] * 1000)},${Math.round(soup[k + 1] * 1000)},${Math.round(soup[k + 2] * 1000)}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = vertices.length / 3;
      ids.set(key, id);
      vertices.push(soup[k], soup[k + 1], soup[k + 2]);
    }
    triangles[k / 3] = id;
  }
  return { vertices: new Float32Array(vertices), triangles };
}

export interface MeshReport {
  triangles: number;
  /** Edges used by only one triangle: holes. */
  openEdges: number;
  /** Edges whose two triangles disagree on which side is outside. */
  flippedEdges: number;
  /** Triangles with no area. */
  degenerate: number;
  /** cm³ */
  volume: number;
  /** cm² */
  area: number;
  closed: boolean;
}

/** What a slicer checks: a closed surface with every face pointing out. Sizes in millimetres. */
export function inspectMesh(mesh: IndexedMesh): MeshReport {
  const { vertices: v, triangles: t } = mesh;
  const edges = new Map<number, number>();
  const count = v.length / 3;
  const key = (a: number, b: number) => a * count + b;
  let degenerate = 0;
  let volume = 0;
  let area = 0;
  for (let k = 0; k < t.length; k += 3) {
    const a = t[k],
      b = t[k + 1],
      c = t[k + 2];
    if (a === b || b === c || a === c) {
      degenerate++;
      continue;
    }
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      edges.set(key(p, q), (edges.get(key(p, q)) ?? 0) + 1);
    }
    const ax = v[a * 3],
      ay = v[a * 3 + 1],
      az = v[a * 3 + 2];
    const bx = v[b * 3] - ax,
      by = v[b * 3 + 1] - ay,
      bz = v[b * 3 + 2] - az;
    const cx = v[c * 3] - ax,
      cy = v[c * 3 + 1] - ay,
      cz = v[c * 3 + 2] - az;
    const nx = by * cz - bz * cy;
    const ny = bz * cx - bx * cz;
    const nz = bx * cy - by * cx;
    const twice = Math.hypot(nx, ny, nz);
    if (twice < 1e-12) degenerate++;
    area += twice / 2;
    // Signed volume of the tetrahedron from the origin.
    volume +=
      (v[a * 3] * (v[b * 3 + 1] * v[c * 3 + 2] - v[b * 3 + 2] * v[c * 3 + 1]) -
        v[a * 3 + 1] * (v[b * 3] * v[c * 3 + 2] - v[b * 3 + 2] * v[c * 3]) +
        v[a * 3 + 2] * (v[b * 3] * v[c * 3 + 1] - v[b * 3 + 1] * v[c * 3])) /
      6;
  }
  let openEdges = 0;
  let flippedEdges = 0;
  for (const [edge, uses] of edges) {
    const a = Math.floor(edge / count);
    const b = edge - a * count;
    const reverse = edges.get(key(b, a)) ?? 0;
    if (uses > 1) flippedEdges += uses - 1;
    if (reverse === 0) openEdges++;
  }
  return {
    triangles: t.length / 3,
    openEdges,
    flippedEdges,
    degenerate,
    volume: volume / 1000,
    area: area / 100,
    closed: openEdges === 0 && flippedEdges === 0,
  };
}

// ── 3MF: a zip holding an XML model, one object per part, each with a colour ──

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let k = 0; k < bytes.length; k++) crc = CRC_TABLE[(crc ^ bytes[k]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** An uncompressed zip; 3MF readers accept stored entries. */
function zip(files: { name: string; data: Uint8Array }[]): Blob {
  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(local.buffer, name, file.data as Uint8Array<ArrayBuffer>);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, file.data.length, true);
    entry.setUint32(24, file.data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    const record = new Uint8Array(46 + name.length);
    record.set(new Uint8Array(entry.buffer), 0);
    record.set(name, 46);
    central.push(record);
    offset += 30 + name.length + file.data.length;
  }
  const centralSize = central.reduce((sum, record) => sum + record.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...(central as Uint8Array<ArrayBuffer>[]), end.buffer], {
    type: "model/3mf",
  });
}

const escapeXml = (text: string) => text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 3MF with each part as its own object and colour, ready for multi-material printers. */
export function write3mf(
  parts: { id: string; name: string; color: string; mesh: IndexedMesh }[],
  title: string,
): Blob {
  const materials = parts
    .map(
      (part) =>
        `<base name="${escapeXml(part.name)}" displaycolor="${part.color.toUpperCase()}FF"/>`,
    )
    .join("");
  const objects = parts
    .map((part, index) => {
      const { vertices, triangles } = part.mesh;
      const vs: string[] = [];
      for (let k = 0; k < vertices.length; k += 3) {
        vs.push(
          `<vertex x="${vertices[k].toFixed(4)}" y="${vertices[k + 1].toFixed(4)}" z="${vertices[k + 2].toFixed(4)}"/>`,
        );
      }
      const ts: string[] = [];
      for (let k = 0; k < triangles.length; k += 3) {
        const [a, b, c] = [triangles[k], triangles[k + 1], triangles[k + 2]];
        if (a === b || b === c || a === c) continue;
        ts.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`);
      }
      return (
        `<object id="${index + 2}" type="model" name="${escapeXml(part.name)}" pid="1" pindex="${index}">` +
        `<mesh><vertices>${vs.join("")}</vertices><triangles>${ts.join("")}</triangles></mesh></object>`
      );
    })
    .join("");
  const items = parts.map((_, index) => `<item objectid="${index + 2}"/>`).join("");
  const model =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<metadata name="Title">${escapeXml(title)}</metadata>` +
    `<metadata name="Application">teetang.art</metadata>` +
    `<resources><basematerials id="1">${materials}</basematerials>${objects}</resources>` +
    `<build>${items}</build></model>`;
  const encoder = new TextEncoder();
  return zip([
    {
      name: "[Content_Types].xml",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
      ),
    },
    { name: "3D/3dmodel.model", data: encoder.encode(model) },
  ]);
}

// ── Terrain clean-up before building the model ──

export interface TerrainEdits {
  /** Extra blur passes; each smooths noise and sharp ridges a little more. */
  smooth: number;
  /** Share of the relief, from the bottom, that is cut flat: makes the peaks stand out. */
  trimLow: number;
  /** Share of the relief, from the top, that is cut flat: a mesa, or room for a lid. */
  trimHigh: number;
}

export function editTerrain(grid: HeightGrid, edits: TerrainEdits): HeightGrid {
  const { size } = grid;
  let heights = grid.heights;
  for (let pass = 0; pass < edits.smooth; pass++) {
    const out = new Float32Array(heights.length);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        let sum = 0;
        let weight = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const y = j + dj;
          if (y < 0 || y >= size) continue;
          for (let di = -1; di <= 1; di++) {
            const x = i + di;
            if (x < 0 || x >= size) continue;
            const w = di === 0 && dj === 0 ? 4 : di === 0 || dj === 0 ? 2 : 1;
            sum += heights[y * size + x] * w;
            weight += w;
          }
        }
        out[j * size + i] = sum / weight;
      }
    }
    heights = out;
  }
  const relief = grid.max - grid.min;
  const floor = grid.min + relief * edits.trimLow;
  const ceiling = grid.max - relief * edits.trimHigh;
  let min = Infinity;
  let max = -Infinity;
  const out = edits.trimLow || edits.trimHigh ? new Float32Array(heights.length) : heights;
  for (let k = 0; k < heights.length; k++) {
    const h = Math.min(Math.max(floor, ceiling), Math.max(floor, heights[k]));
    out[k] = h;
    if (h < min) min = h;
    if (h > max) max = h;
  }
  return { size, heights: out, min, max };
}

// ── Water inlay ──

/**
 * A solid that fills the carved lakes and rivers: for multi-material
 * printers, the water prints in its own colour. Built cell by cell over the
 * terrain's surface grid, with walls only where water meets land, so it closes
 * into a watertight solid. `depth` is the carve depth in plate units.
 */
export function buildWaterInlay(
  geometry: PlateGeometry,
  mask: Float32Array,
  maskSize: number,
  depth: number,
): Float32Array | null {
  const { size, surface, uvs } = geometry;
  const cells = size - 1;
  const sample = (u: number, v: number) => {
    const x = Math.min(maskSize - 1, Math.max(0, Math.round(u * (maskSize - 1))));
    const y = Math.min(maskSize - 1, Math.max(0, Math.round(v * (maskSize - 1))));
    return mask[y * maskSize + x];
  };
  const wet = new Uint8Array(cells * cells);
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * size + i;
      const d = a + size + 1;
      wet[j * cells + i] =
        sample((uvs[a * 2] + uvs[d * 2]) / 2, (uvs[a * 2 + 1] + uvs[d * 2 + 1]) / 2) >= 0.5 ? 1 : 0;
    }
  }
  // Two water cells touching only at a corner would make an edge with four
  // faces, which slicers reject: fill one of the dry cells beside them.
  for (let changed = true; changed;) {
    changed = false;
    for (let j = 0; j + 1 < cells; j++) {
      for (let i = 0; i + 1 < cells; i++) {
        const nw = wet[j * cells + i];
        const ne = wet[j * cells + i + 1];
        const sw = wet[(j + 1) * cells + i];
        const sE = wet[(j + 1) * cells + i + 1];
        if ((nw && sE && !ne && !sw) || (ne && sw && !nw && !sE)) {
          wet[j * cells + i + 1] = 1;
          wet[j * cells + i] = 1;
          changed = true;
        }
      }
    }
  }
  const out: number[] = [];
  const top = (k: number) => [surface[k * 3], surface[k * 3 + 1] + depth, surface[k * 3 + 2]];
  const low = (k: number) => [surface[k * 3], surface[k * 3 + 1], surface[k * 3 + 2]];
  const tri = (p: number[], q: number[], r: number[]) => out.push(...p, ...q, ...r);
  const isWet = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < cells && j < cells && wet[j * cells + i] === 1;
  // Faces are oriented from the grid's structure, not from geometry: the top
  // copies the terrain's own winding, the bottom mirrors it, and each wall
  // runs against the top edge it closes. Warped shapes squeeze some cells
  // almost flat, where a geometric test would guess wrong.
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      if (!isWet(i, j)) continue;
      const a = j * size + i;
      const s = a + size;
      const e = a + 1;
      const se = s + 1;
      tri(top(a), top(s), top(e));
      tri(top(e), top(s), top(se));
      tri(low(a), low(e), low(s));
      tri(low(e), low(se), low(s));
      // The top's boundary edges, as directed in its triangles, with the neighbour across each.
      const edges: [number, number, number, number][] = [
        [e, a, i, j - 1],
        [se, e, i + 1, j],
        [s, se, i, j + 1],
        [a, s, i - 1, j],
      ];
      for (const [p, q, ni, nj] of edges) {
        if (isWet(ni, nj)) continue;
        tri(top(q), top(p), low(p));
        tri(top(q), low(p), low(q));
      }
    }
  }
  return out.length ? new Float32Array(out) : null;
}
