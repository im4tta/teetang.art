import maplibregl from "maplibre-gl";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/**
 * Apply style changes incrementally via setPaintProperty / setLayoutProperty
 * instead of calling setStyle() which triggers a full style diff.
 */
export function applyIncrementalStyleUpdate(
  map: maplibregl.Map,
  prev: StyleSpecification,
  next: StyleSpecification,
): void {
  const prevLayerMap = new Map(prev.layers.map((l) => [l.id, l] as [string, LayerSpecification]));

  for (const layer of next.layers) {
    const prevLayer = prevLayerMap.get(layer.id);
    if (!prevLayer) continue;

    // Diff paint properties
    const nextPaint = (layer as Record<string, unknown>).paint as Record<string, unknown> | undefined;
    const prevPaint = (prevLayer as Record<string, unknown>).paint as Record<string, unknown> | undefined;
    if (nextPaint) {
      for (const key of Object.keys(nextPaint)) {
        if (JSON.stringify(nextPaint[key]) !== JSON.stringify(prevPaint?.[key])) {
          map.setPaintProperty(layer.id, key, nextPaint[key]);
        }
      }
    }

    // Diff layout properties
    const nextLayout = (layer as Record<string, unknown>).layout as Record<string, unknown> | undefined;
    const prevLayout = (prevLayer as Record<string, unknown>).layout as Record<string, unknown> | undefined;
    if (nextLayout) {
      for (const key of Object.keys(nextLayout)) {
        if (JSON.stringify(nextLayout[key]) !== JSON.stringify(prevLayout?.[key])) {
          map.setLayoutProperty(layer.id, key, nextLayout[key]);
        }
      }
    }

    // Diff minzoom / maxzoom
    const nextAny = layer as Record<string, unknown>;
    const prevAny = prevLayer as Record<string, unknown>;
    if (nextAny.minzoom !== prevAny.minzoom || nextAny.maxzoom !== prevAny.maxzoom) {
      map.setLayerZoomRange(
        layer.id,
        (nextAny.minzoom as number) ?? 0,
        (nextAny.maxzoom as number) ?? 24,
      );
    }
  }
}

export function styleLayersChanged(prev: StyleSpecification, next: StyleSpecification): boolean {
  const prevIds = prev.layers.map(l => l.id).sort();
  const nextIds = next.layers.map(l => l.id).sort();
  if (prevIds.length !== nextIds.length) return true;
  return prevIds.some((id, i) => id !== nextIds[i]);
}
