/**
 * Where rain goes. Every cell of the height grid drains to its steepest lower
 * neighbour, after the grid's false pits (noise and tiny dips in the data) are
 * filled so water always finds a way to the plate's edge or the sea. From that
 * drainage tree a pin gets the path rain follows downhill and its catchment:
 * all the ground that drains through it.
 */
import type { HeightGrid } from "./elevationCore";

/** Ground at or below this height, in metres, is the sea, where rain stops. */
const SEA_M = 0.5;
/** Each filled cell sits this far above the one it drains to, so flats still slope. */
const EPSILON_M = 1e-3;

const NEIGHBOURS: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** A binary min-heap of cells keyed by height, ties in arrival order. Fixed capacity, typed arrays. */
class CellHeap {
  private keys: Float64Array;
  private cells: Int32Array;
  private order: Int32Array;
  private count = 0;
  private length = 0;

  constructor(capacity: number) {
    this.keys = new Float64Array(capacity);
    this.cells = new Int32Array(capacity);
    this.order = new Int32Array(capacity);
  }

  get size() {
    return this.length;
  }

  private less(a: number, b: number) {
    return (
      this.keys[a] < this.keys[b] ||
      (this.keys[a] === this.keys[b] && this.order[a] < this.order[b])
    );
  }

  private swap(a: number, b: number) {
    const key = this.keys[a];
    const cell = this.cells[a];
    const order = this.order[a];
    this.keys[a] = this.keys[b];
    this.cells[a] = this.cells[b];
    this.order[a] = this.order[b];
    this.keys[b] = key;
    this.cells[b] = cell;
    this.order[b] = order;
  }

  push(key: number, cell: number) {
    let at = this.length++;
    this.keys[at] = key;
    this.cells[at] = cell;
    this.order[at] = this.count++;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (!this.less(at, parent)) break;
      this.swap(at, parent);
      at = parent;
    }
  }

  /** Removes the lowest cell; its height is left in `lastKey`. */
  lastKey = 0;
  pop(): number {
    const cell = this.cells[0];
    this.lastKey = this.keys[0];
    const last = --this.length;
    this.swap(0, last);
    let at = 0;
    for (;;) {
      const left = at * 2 + 1;
      const right = left + 1;
      let small = at;
      if (left < last && this.less(left, small)) small = left;
      if (right < last && this.less(right, small)) small = right;
      if (small === at) break;
      this.swap(at, small);
      at = small;
    }
    return cell;
  }
}

export interface DrainageTree {
  size: number;
  /** The cell each cell drains to, or -1 where water leaves the plate (a low point on its edge). */
  down: Int32Array;
  /** Heights after the pits were filled. */
  filled: Float32Array;
  /** How many cells drain through each cell, itself included. */
  accumulation: Int32Array;
}

const trees = new WeakMap<HeightGrid, DrainageTree>();

/** Fills the false pits (priority flood) and points every cell at its steepest way down. */
export function drainageTree(grid: HeightGrid): DrainageTree {
  const cached = trees.get(grid);
  if (cached) return cached;
  const { size, heights } = grid;
  const filled = Float32Array.from(heights);
  const done = new Uint8Array(size * size);
  const heap = new CellHeap(size * size);
  const last = size - 1;

  // Water leaves the plate over its edge, so the flood starts there.
  for (let k = 0; k < size; k++) {
    for (const cell of [k, last * size + k, k * size, k * size + last]) {
      if (done[cell]) continue;
      done[cell] = 1;
      heap.push(filled[cell], cell);
    }
  }
  while (heap.size) {
    const cell = heap.pop();
    const level = heap.lastKey;
    const ci = cell % size;
    const cj = (cell - ci) / size;
    for (const [di, dj] of NEIGHBOURS) {
      const i = ci + di;
      const j = cj + dj;
      if (i < 0 || j < 0 || i > last || j > last) continue;
      const next = j * size + i;
      if (done[next]) continue;
      done[next] = 1;
      // A cell lower than the flood level is in a pit: raise it to just above its outlet.
      if (filled[next] <= level) filled[next] = level + EPSILON_M;
      heap.push(filled[next], next);
    }
  }

  const down = new Int32Array(size * size).fill(-1);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const cell = j * size + i;
      let best = -1;
      let steepest = 0;
      const onEdge = i === 0 || j === 0 || i === last || j === last;
      for (const [di, dj] of NEIGHBOURS) {
        if (i + di < 0 || j + dj < 0 || i + di > last || j + dj > last) continue;
        // Water that reaches the edge leaves the plate; it does not run along it.
        if (onEdge && (i + di === 0 || j + dj === 0 || i + di === last || j + dj === last))
          continue;
        const next = (j + dj) * size + i + di;
        const drop = (filled[cell] - filled[next]) / (di && dj ? Math.SQRT2 : 1);
        if (drop > steepest) {
          steepest = drop;
          best = next;
        }
      }
      down[cell] = best;
    }
  }
  // Flow accumulation: pass each cell's total on downhill once everything above it has arrived.
  const accumulation = new Int32Array(size * size).fill(1);
  const waiting = new Int32Array(size * size);
  for (let k = 0; k < down.length; k++) if (down[k] >= 0) waiting[down[k]]++;
  const ready: number[] = [];
  for (let k = 0; k < down.length; k++) if (!waiting[k]) ready.push(k);
  while (ready.length) {
    const cell = ready.pop()!;
    const next = down[cell];
    if (next < 0) continue;
    accumulation[next] += accumulation[cell];
    if (--waiting[next] === 0) ready.push(next);
  }
  const tree = { size, down, filled, accumulation };
  trees.set(grid, tree);
  return tree;
}

export interface Drainage {
  /** The path rain takes from the pin, as plate positions (0..1 from the west and north). */
  path: [number, number][];
  /** Ground length of the path, in metres. */
  lengthM: number;
  /** How far the water falls along the path, in metres. */
  dropM: number;
  /** Whether the path ends at the sea (otherwise it leaves over the plate's edge). */
  reachesSea: boolean;
  /** Cells per side of `catchment`. */
  size: number;
  /** Where the catchment is measured: the pin, or the stream just beside it (0..1 on the plate). */
  outlet: [number, number];
  /** Whether the outlet was moved from the pin onto a nearby stream. */
  snapped: boolean;
  /** `size × size`: 1 for ground that drains through the outlet. */
  catchment: Uint8Array;
  catchmentKm2: number;
}

/**
 * @param widthM ground width of the plate, in metres
 * @param u,v the pin on the plate, 0..1 from the west and from the north
 */
export function computeDrainage(grid: HeightGrid, widthM: number, u: number, v: number): Drainage {
  const { size, heights } = grid;
  const { down, accumulation } = drainageTree(grid);
  const last = size - 1;
  const cellM = widthM / last;
  const start = Math.round(v * last) * size + Math.round(u * last);

  // Downhill from the pin.
  const path: [number, number][] = [];
  let lengthM = 0;
  let cell = start;
  let reachesSea = false;
  for (let guard = 0; guard < size * size; guard++) {
    const i = cell % size;
    path.push([i / last, (cell - i) / size / last]);
    if (heights[cell] <= SEA_M && cell !== start) {
      reachesSea = true;
      break;
    }
    const next = down[cell];
    if (next < 0) break;
    const ni = next % size;
    lengthM += Math.hypot(ni - i, (next - ni) / size - (cell - i) / size) * cellM;
    cell = next;
  }
  const dropM = heights[start] - heights[cell];

  // A pin is rarely exactly on a stream. Measure the catchment at the strongest stream within a
  // few cells, when that is clearly stronger than the pin's own cell.
  const reach = 3;
  const pi = start % size;
  const pj = (start - pi) / size;
  let outletCell = start;
  for (let dj = -reach; dj <= reach; dj++) {
    for (let di = -reach; di <= reach; di++) {
      const i = pi + di;
      const j = pj + dj;
      if (i < 0 || j < 0 || i > last || j > last || Math.hypot(di, dj) > reach) continue;
      const cell = j * size + i;
      if (accumulation[cell] > accumulation[outletCell]) outletCell = cell;
    }
  }
  const snapped = outletCell !== start && accumulation[outletCell] >= 2 * accumulation[start];
  const outlet = snapped ? outletCell : start;

  // Uphill: everything whose way down passes through the outlet.
  const first = new Int32Array(size * size + 1);
  for (let k = 0; k < down.length; k++) if (down[k] >= 0) first[down[k] + 1]++;
  for (let k = 0; k < size * size; k++) first[k + 1] += first[k];
  const fill = first.slice(0, size * size);
  const upstream = new Int32Array(first[size * size]);
  for (let k = 0; k < down.length; k++) if (down[k] >= 0) upstream[fill[down[k]]++] = k;
  const catchment = new Uint8Array(size * size);
  const stack = [outlet];
  catchment[outlet] = 1;
  let count = 0;
  while (stack.length) {
    const top = stack.pop()!;
    count++;
    for (let k = first[top]; k < first[top + 1]; k++) {
      const from = upstream[k];
      if (catchment[from]) continue;
      catchment[from] = 1;
      stack.push(from);
    }
  }
  return {
    path,
    lengthM,
    dropM,
    reachesSea,
    outlet: [(outlet % size) / last, Math.floor(outlet / size) / last],
    snapped,
    size,
    catchment,
    catchmentKm2: (count * cellM * cellM) / 1e6,
  };
}
