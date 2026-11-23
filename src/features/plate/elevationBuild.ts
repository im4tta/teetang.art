/**
 * Builds a plate's height grid from the source it asks for, and from the
 * worldwide tiles when that source cannot answer. Shared by the worker and the
 * main-thread fallback.
 */
import {
  buildHeightGrid,
  type ElevationMeta,
  type HeightGrid,
  type TileReader,
} from "./elevationCore";
import {
  DEFAULT_SOURCE,
  isOpenTopoKey,
  openTopoDataset,
  sourceById,
  type ElevationSource,
} from "./elevationSources";
import { SourceError, load3dep, loadCopernicus, loadOpenTopography } from "./elevationRemote";
import { gridFromRasters, type GeoRaster } from "./rasterGrid";
import type { PlateBounds } from "./geo";

export interface ElevationRequest {
  /** `plate.elevation`: "" for the worldwide tiles, or a source id. */
  source: string;
  /** A visitor's own OpenTopography key; never part of a link. */
  key?: string;
}

/** Fewest samples of real data a source must return, or the worldwide tiles fill in. */
const MIN_COVERAGE = 0.6;

export const requestKey = (request: ElevationRequest) =>
  `${request.source}|${isOpenTopoKey(request.key) ? "k" : ""}`;

function whyNot(
  source: ElevationSource,
  bounds: PlateBounds,
  request: ElevationRequest,
): SourceError["reason"] | null {
  if (!source.covers(bounds)) return "coverage";
  if (source.maxKm && bounds.sizeMeters > source.maxKm * 1000) return "size";
  if (source.needsKey && !isOpenTopoKey(request.key)) return "key";
  return null;
}

async function loadRasters(
  source: ElevationSource,
  bounds: PlateBounds,
  cells: number,
  request: ElevationRequest,
  signal?: AbortSignal,
): Promise<GeoRaster[]> {
  if (source.id === "copernicus") return loadCopernicus(bounds, cells, signal);
  if (source.id === "usgs3dep") return load3dep(bounds, cells, signal);
  if (openTopoDataset(source.id)) {
    return loadOpenTopography(bounds, source.id, request.key, signal);
  }
  throw new SourceError("failed", "unknown-source");
}

export async function buildElevation(
  bounds: PlateBounds,
  cells: number,
  request: ElevationRequest,
  readTile: TileReader,
  signal?: AbortSignal,
): Promise<HeightGrid> {
  const source = sourceById(request.source) ?? DEFAULT_SOURCE;
  if (!source.id) return buildHeightGrid(bounds, cells, readTile, signal);

  let reason = whyNot(source, bounds, request);
  if (!reason) {
    try {
      const rasters = await loadRasters(source, bounds, cells, request, signal);
      const grid = gridFromRasters(bounds, cells, rasters);
      if (grid.coverage < MIN_COVERAGE) throw new SourceError("coverage");
      const meta: ElevationMeta = {
        requested: source.id,
        used: source.id,
        label: source.credit,
        resolutionM: source.resolutionM,
      };
      return { size: grid.size, heights: grid.heights, min: grid.min, max: grid.max, meta };
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      reason = error instanceof SourceError ? error.reason : "failed";
    }
  }

  const fallback = await buildHeightGrid(bounds, cells, readTile, signal);
  fallback.meta = {
    ...(fallback.meta ?? { label: DEFAULT_SOURCE.credit, used: "" }),
    requested: source.id,
    used: "",
    fellBack: reason,
  };
  return fallback;
}

/** Text for the credit line under the plate. */
export function elevationCredit(meta: ElevationMeta | undefined): string {
  if (!meta) return DEFAULT_SOURCE.credit;
  if (meta.used) return meta.label;
  return meta.label && meta.label !== DEFAULT_SOURCE.credit
    ? `${meta.label} via ${DEFAULT_SOURCE.credit}`
    : DEFAULT_SOURCE.credit;
}
