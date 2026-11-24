import { buildElevation, requestKey, type ElevationRequest } from "./elevationBuild";
import type { HeightGrid } from "./elevationCore";
import { readRgbaTile } from "./elevationTiles";
import type { PlateBounds } from "./geo";

/**
 * Loads a height grid for the plate. Decoding runs in a worker so dragging and
 * typing stay smooth; browsers without module workers or OffscreenCanvas fall
 * back to the main thread.
 */

type Pending = { resolve: (grid: HeightGrid) => void; reject: (error: Error) => void };

let worker: Worker | null | undefined;
const pending = new Map<number, Pending>();
let nextId = 0;
const cache = new Map<string, HeightGrid>();
const CACHE_LIMIT = 8;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return (worker = null);
  }
  try {
    worker = new Worker(new URL("./elevation.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.grid);
    };
    worker.onerror = () => {
      // A worker that cannot start: finish what is waiting on the main thread.
      worker?.terminate();
      worker = null;
      pending.forEach((request) => request.reject(new Error("worker-failed")));
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

function inWorker(
  bounds: PlateBounds,
  cells: number,
  request: ElevationRequest,
  target: Worker,
): Promise<HeightGrid> {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    target.postMessage({ id, bounds, cells, request });
  });
}

const keyFor = (bounds: PlateBounds, cells: number, request: ElevationRequest) =>
  [bounds.x0, bounds.y0, bounds.x1, cells].map((n) => n.toFixed(7)).join(",") +
  `|${requestKey(request)}`;

export async function loadHeightGrid(
  bounds: PlateBounds,
  cells: number,
  signal?: AbortSignal,
  request: ElevationRequest = { source: "" },
): Promise<HeightGrid> {
  const key = keyFor(bounds, cells, request);
  const cached = cache.get(key);
  if (cached) return cached;

  const target = getWorker();
  let grid: HeightGrid;
  try {
    grid = target
      ? await inWorker(bounds, cells, request, target)
      : await buildElevation(bounds, cells, request, readRgbaTile, signal);
  } catch (error) {
    if ((error as Error).message !== "worker-failed") throw error;
    grid = await buildElevation(bounds, cells, request, readRgbaTile, signal);
  }
  signal?.throwIfAborted();

  // A source that failed may work next time; only settled answers are kept.
  if (grid.meta?.fellBack !== "failed") {
    cache.set(key, grid);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  }
  return grid;
}
