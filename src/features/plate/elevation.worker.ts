/// <reference lib="webworker" />
import { buildHeightGrid } from "./elevationCore";
import { readRgbaTile } from "./elevationTiles";
import type { PlateBounds } from "./geo";

interface Request {
  id: number;
  bounds: PlateBounds;
  cells: number;
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const grid = await buildHeightGrid(data.bounds, data.cells, readRgbaTile);
    self.postMessage({ id: data.id, grid }, [grid.heights.buffer]);
  } catch (error) {
    self.postMessage({ id: data.id, error: (error as Error).message });
  }
};
