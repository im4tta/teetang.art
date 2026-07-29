import { useEffect, useRef } from "react";
import type { MapInstanceRef } from "@/services/map/types";

const POI_QUERIES: Record<string, string> = {
  poiSchools: `node["amenity"="school"]({{bbox}});node["amenity"="kindergarten"]({{bbox}});`,
  poiHospitals: `node["amenity"="hospital"]({{bbox}});node["amenity"="clinic"]({{bbox}});`,
  poiMarkets: `node["shop"="supermarket"]({{bbox}});node["amenity"="marketplace"]({{bbox}});`,
  poiBanks: `node["amenity"="bank"]({{bbox}});node["amenity"="atm"]({{bbox}});`,
  poiRestaurants: `node["amenity"="restaurant"]({{bbox}});node["amenity"="cafe"]({{bbox}});`,
};

const POI_COLORS: Record<string, string> = {
  poiSchools: "#4F46E5",
  poiHospitals: "#EF4444",
  poiMarkets: "#F59E0B",
  poiBanks: "#10B981",
  poiRestaurants: "#EC4899",
};

const POI_LABELS: Record<string, string> = {
  poiSchools: "School",
  poiHospitals: "Hospital",
  poiMarkets: "Market",
  poiBanks: "Bank",
  poiRestaurants: "Restaurant",
};

const POI_TYPE_MAP: Record<string, string[]> = {
  poiSchools: ["school", "kindergarten"],
  poiHospitals: ["hospital", "clinic"],
  poiMarkets: ["supermarket", "marketplace"],
  poiBanks: ["bank", "atm"],
  poiRestaurants: ["restaurant", "cafe", "fast_food"],
};

interface PoiOverlayProps {
  mapRef: MapInstanceRef;
  center: [lon: number, lat: number];
  visible: boolean;
  activeTypes: string[];
}

export default function PoiOverlay({ mapRef, center, visible, activeTypes }: PoiOverlayProps) {
  const poiDataRef = useRef<Record<string, any[]>>({});
  const prevTypesRef = useRef<string>("");

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const enabledTypes = Object.keys(POI_QUERIES).filter((k) => activeTypes.includes(k));
    const typesKey = enabledTypes.sort().join(",");

    const removeAllLayers = () => {
      for (const key of Object.keys(POI_QUERIES)) {
        if (map.getLayer(`poi-${key}`)) map.removeLayer(`poi-${key}`);
        if (map.getSource(`poi-${key}`)) map.removeSource(`poi-${key}`);
      }
    };

    const addPoiLayers = () => {
      for (const [key, color] of Object.entries(POI_COLORS)) {
        if (!enabledTypes.includes(key)) {
          if (map.getLayer(`poi-${key}`)) map.removeLayer(`poi-${key}`);
          if (map.getSource(`poi-${key}`)) map.removeSource(`poi-${key}`);
          continue;
        }
        if (!map.getSource(`poi-${key}`)) {
          map.addSource(`poi-${key}`, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: `poi-${key}`,
            type: "circle",
            source: `poi-${key}`,
            paint: {
              "circle-radius": 6,
              "circle-color": color,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.8,
            },
          });
        }
      }
    };

    const fetchPois = async () => {
      const bbox = `${center[1] - 0.05},${center[0] - 0.05},${center[1] + 0.05},${center[0] + 0.05}`;
      const queries = enabledTypes
        .map((k) => POI_QUERIES[k])
        .filter(Boolean)
        .join("");

      if (!queries) return;

      const overpassQuery = `[out:json];(${queries.replace(/{{bbox}}/g, bbox)});out center;`;

      try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: `data=${encodeURIComponent(overpassQuery)}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        const data = await res.json();
        const grouped: Record<string, any[]> = {};
        for (const el of data.elements || []) {
          const lat = el.lat || el.center?.lat;
          const lon = el.lon || el.center?.lon;
          if (!lat || !lon) continue;
          for (const key of enabledTypes) {
            const amenity = el.tags?.amenity || el.tags?.shop || "";
            const matches = (POI_TYPE_MAP[key] || []).some((t) => amenity === t);
            if (matches) {
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [lon, lat] },
                properties: { name: el.tags?.name || POI_LABELS[key] },
              });
            }
          }
        }
        poiDataRef.current = grouped;

        for (const key of enabledTypes) {
          const source = map.getSource(`poi-${key}`) as any;
          if (source) {
            source.setData({
              type: "FeatureCollection",
              features: grouped[key] || [],
            });
          }
        }
      } catch {
        // ignore fetch failures
      }
    };

    if (!visible) {
      removeAllLayers();
      return;
    }

    const setup = () => {
      if (typesKey !== prevTypesRef.current) {
        removeAllLayers();
        prevTypesRef.current = typesKey;
      }
      addPoiLayers();
      void fetchPois();
    };

    if (map.isStyleLoaded()) {
      setup();
    } else {
      map.once("load", setup);
    }

    return () => {
      // Don't remove layers on cleanup - let re-render handle it
    };
  }, [mapRef, center, visible, activeTypes]);

  return null;
}
