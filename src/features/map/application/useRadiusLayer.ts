import { type MutableRefObject, useEffect } from "react";
import maplibregl from "maplibre-gl";

type RadiusStyle = "dashed" | "filled" | "gradient";

interface UseRadiusLayerOptions {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  /** Reactive values read via refs inside the effect to avoid re-mounting */
  radiusMeters: number;
  radiusStyle: string;
  radiusLabel: string;
  center: [lon: number, lat: number];
}

function getCircleColor(style: RadiusStyle): string {
  switch (style) {
    case "filled": return "rgba(200, 200, 255, 0.25)";
    case "gradient": return "rgba(200, 200, 255, 0.08)";
    default: return "rgba(200, 200, 255, 0.12)";
  }
}

function getStrokeColor(style: RadiusStyle): string {
  switch (style) {
    case "filled": return "rgba(200, 200, 255, 0.6)";
    case "gradient": return "rgba(200, 200, 255, 0.35)";
    default: return "rgba(200, 200, 255, 0.5)";
  }
}

function getStrokeDasharray(style: RadiusStyle): [number, number] | undefined {
  return style === "dashed" ? [4, 4] : undefined;
}

export function useRadiusLayer({
  mapRef,
  radiusMeters,
  radiusStyle,
  center,
}: UseRadiusLayerOptions): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const r = radiusMeters;
    const style = radiusStyle as RadiusStyle;

    const updateRadius = () => {
      if (!map.getSource("radius-source")) {
        map.addSource("radius-source", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "Point", coordinates: center },
            properties: {},
          },
        });
        map.addLayer({
          id: "radius-circle",
          type: "circle",
          source: "radius-source",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, 0, 22, r / 30],
            "circle-color": getCircleColor(style),
            "circle-stroke-width": 2,
            "circle-stroke-color": getStrokeColor(style),
            "circle-stroke-opacity": style === "gradient" ? 0.4 : 0.7,
          },
        });
      } else {
        const source = map.getSource("radius-source") as maplibregl.GeoJSONSource;
        source.setData({
          type: "Feature",
          geometry: { type: "Point", coordinates: center },
          properties: {},
        });
        if (map.getLayer("radius-circle")) {
          map.setPaintProperty("radius-circle", "circle-radius", [
            "interpolate", ["linear"], ["zoom"], 0, 0, 22, r / 30,
          ]);
          map.setPaintProperty("radius-circle", "circle-color", getCircleColor(style));
          map.setPaintProperty("radius-circle", "circle-stroke-color", getStrokeColor(style));
        }
      }

      if (map.getLayer("radius-circle")) {
        map.setLayoutProperty(
          "radius-circle",
          "visibility",
          r <= 0 ? "none" : "visible",
        );
      }
    };

    if (map.isStyleLoaded()) {
      updateRadius();
    } else {
      map.once("load", updateRadius);
      return () => { map.off("load", updateRadius); };
    }
  }, [radiusMeters, radiusStyle, center, mapRef]);
}
