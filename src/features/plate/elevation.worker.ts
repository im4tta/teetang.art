/// <reference lib="webworker" />
import { buildElevation, type ElevationRequest } from "./elevationBuild";
import { readRgbaTile } from "./elevationTiles";
import type { PlateBounds } from "./geo";

interface Request {
  id: number;
  bounds: PlateBounds;
  cells: number;
  request: ElevationRequest;
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    const grid = await buildElevation(data.bounds, data.cells, data.request, readRgbaTile);
    self.postMessage({ id: data.id, grid }, [grid.heights.buffer]);
  } catch (error) {
    self.postMessage({ id: data.id, error: (error as Error).message });
  }
};
