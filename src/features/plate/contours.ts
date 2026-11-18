/**
 * Contour lines for the SVG download, traced with marching squares over the
 * same grid the 3D view uses.
 */
import type { PlateGeometry } from "./geometry";

export interface ContourLevel {
  metres: number;
  /** Every fifth line is an index contour, drawn heavier. */
  index: boolean;
  /** Polylines in plate coordinates, x and z pairs. */
  lines: number[][];
}

const edgeKey = (a: number, b: number) => (a < b ? a * 0x200000 + b : b * 0x200000 + a);

export function traceContours(geometry: PlateGeometry, interval: number): ContourLevel[] {
  const { size, elevations, surface } = geometry;
  const cells = size - 1;
  const first = Math.ceil(geometry.min / interval) * interval;
  const levels: ContourLevel[] = [];

  for (let level = first; level <= geometry.max; level += interval) {
    // A crossing on the grid edge between vertices a and b.
    const points = new Map<number, [number, number]>();
    const crossing = (a: number, b: number): number => {
      const key = edgeKey(a, b);
      if (!points.has(key)) {
        const ha = elevations[a];
        const hb = elevations[b];
        const t = ha === hb ? 0.5 : (level - ha) / (hb - ha);
        points.set(key, [
          surface[a * 3] + (surface[b * 3] - surface[a * 3]) * t,
          surface[a * 3 + 2] + (surface[b * 3 + 2] - surface[a * 3 + 2]) * t,
        ]);
      }
      return key;
    };

    const segments: [number, number][] = [];
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const a = j * size + i;
        const b = a + 1;
        const c = b + size;
        const d = a + size;
        const above = (k: number) => (elevations[k] >= level ? 1 : 0);
        const mask = above(a) | (above(b) << 1) | (above(c) << 2) | (above(d) << 3);
        if (mask === 0 || mask === 15) continue;
        const top = () => crossing(a, b);
        const right = () => crossing(b, c);
        const bottom = () => crossing(d, c);
        const left = () => crossing(a, d);
        const centreAbove =
          (elevations[a] + elevations[b] + elevations[c] + elevations[d]) / 4 >= level;
        switch (mask) {
          case 1:
          case 14:
            segments.push([left(), top()]);
            break;
          case 2:
          case 13:
            segments.push([top(), right()]);
            break;
          case 3:
          case 12:
            segments.push([left(), right()]);
            break;
          case 4:
          case 11:
            segments.push([right(), bottom()]);
            break;
          case 6:
          case 9:
            segments.push([top(), bottom()]);
            break;
          case 7:
          case 8:
            segments.push([left(), bottom()]);
            break;
          case 5:
            if (centreAbove) segments.push([left(), bottom()], [top(), right()]);
            else segments.push([left(), top()], [right(), bottom()]);
            break;
          case 10:
            if (centreAbove) segments.push([left(), top()], [right(), bottom()]);
            else segments.push([left(), bottom()], [top(), right()]);
            break;
        }
      }
    }
    if (segments.length === 0) continue;

    // Join segments that share a crossing into long polylines.
    const byPoint = new Map<number, number[]>();
    segments.forEach(([p, q], index) => {
      for (const key of [p, q]) {
        const list = byPoint.get(key);
        if (list) list.push(index);
        else byPoint.set(key, [index]);
      }
    });
    const used = new Uint8Array(segments.length);
    const lines: number[][] = [];
    const extend = (chain: number[], from: number) => {
      let current = from;
      for (;;) {
        const next = byPoint.get(current)?.find((index) => !used[index]);
        if (next === undefined) return;
        used[next] = 1;
        const [p, q] = segments[next];
        current = p === current ? q : p;
        chain.push(current);
      }
    };
    segments.forEach(([p, q], index) => {
      if (used[index]) return;
      used[index] = 1;
      const forward = [p, q];
      extend(forward, q);
      const backward = [p];
      extend(backward, p);
      const chain = [...backward.reverse(), ...forward.slice(1)];
      lines.push(chain.flatMap((key) => points.get(key)!));
    });

    const step = Math.round(level / interval);
    levels.push({ metres: level, index: step % 5 === 0, lines });
  }
  return levels;
}

/** Ramer–Douglas–Peucker on an x, z polyline; keeps files small for plotters. */
export function simplify(line: number[], tolerance: number): number[] {
  const count = line.length / 2;
  if (count < 3) return line;
  const keep = new Uint8Array(count);
  keep[0] = keep[count - 1] = 1;
  const stack: [number, number][] = [[0, count - 1]];
  const tol2 = tolerance * tolerance;
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const ax = line[start * 2],
      az = line[start * 2 + 1];
    const dx = line[end * 2] - ax,
      dz = line[end * 2 + 1] - az;
    const length2 = dx * dx + dz * dz || 1e-12;
    let worst = -1;
    let worstDistance = tol2;
    for (let k = start + 1; k < end; k++) {
      const px = line[k * 2] - ax,
        pz = line[k * 2 + 1] - az;
      const t = Math.max(0, Math.min(1, (px * dx + pz * dz) / length2));
      const ex = px - t * dx,
        ez = pz - t * dz;
      const distance = ex * ex + ez * ez;
      if (distance > worstDistance) {
        worst = k;
        worstDistance = distance;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([start, worst], [worst, end]);
    }
  }
  const out: number[] = [];
  for (let k = 0; k < count; k++) if (keep[k]) out.push(line[k * 2], line[k * 2 + 1]);
  return out;
}
