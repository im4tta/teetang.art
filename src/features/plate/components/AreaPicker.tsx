import { useEffect, useRef, useState } from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocateFixed } from "lucide-react";
import { useI18n } from "@/context/i18n/context";
import type { TranslationKey } from "@/context/i18n/types";
import { notify } from "@/services/notify";
import { PICKER_BASES, roundSize, type PickerBase } from "../plateSettings";

const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

export interface AreaChange {
  lat: number;
  lon: number;
  sizeKm: number;
}

interface AreaPickerProps {
  lat: number;
  lon: number;
  sizeKm: number;
  base: PickerBase;
  onBaseChange: (base: PickerBase) => void;
  onChange: (area: AreaChange) => void;
}

type Layer = { tiles: string; maxzoom: number; attribution: string };

// CARTO tiles go through our own proxy (api/carto.ts), which holds the key.
const dpr = typeof window !== "undefined" && window.devicePixelRatio > 1 ? 2 : 1;
const carto = (style: string) =>
  `/api/carto/rastertiles/${style}/{z}/{x}/{y}${dpr > 1 ? "@2x" : ""}.png`;

/** Free maps, used when the site has no Google Maps key. */
const FREE_LAYERS: Record<PickerBase, Layer[]> = {
  map: [
    { tiles: carto("voyager"), maxzoom: 20, attribution: "© CARTO © OpenStreetMap contributors" },
  ],
  satellite: [
    {
      tiles:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxzoom: 19,
      attribution: "© Esri, Maxar, Earthstar Geographics",
    },
    { tiles: carto("voyager_only_labels"), maxzoom: 20, attribution: "© CARTO" },
  ],
  terrain: [
    {
      tiles: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
      maxzoom: 17,
      attribution: "© OpenTopoMap (CC-BY-SA) © OpenStreetMap contributors",
    },
  ],
};

/** Google Map Tiles API through api/google.ts; labels follow the app language. */
const googleTiles = (type: "roadmap" | "satellite", lang: string) =>
  `/api/google?t=${type}&l=${lang}&r=${dpr}&z={z}&x={x}&y={y}`;

function layersFor(base: PickerBase, google: boolean, lang: string): Layer[] {
  if (!google || base === "terrain") return FREE_LAYERS[base];
  // Google's credit is drawn by the picker itself (logo text and copyright).
  return [
    {
      tiles: googleTiles(base === "map" ? "roadmap" : "satellite", lang),
      maxzoom: 21,
      attribution: "",
    },
  ];
}

/** Whether the server has a Google Maps key; asked once per page load. */
let googleStatus: Promise<boolean> | undefined;
const googleEnabled = () =>
  (googleStatus ??= fetch("/api/google?status=1")
    .then((response) => (response.ok ? response.json() : { enabled: false }))
    .then((data: { enabled?: boolean }) => data.enabled === true)
    .catch(() => false));

const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#e8e4dc" } }],
};

function styleFor(base: PickerBase, google: boolean, lang: string): StyleSpecification {
  const layers = layersFor(base, google, lang);
  return {
    version: 8,
    sources: Object.fromEntries(
      layers.map((layer, index) => [
        `${base}-${index}`,
        {
          type: "raster",
          tiles: [layer.tiles],
          tileSize: 256,
          maxzoom: layer.maxzoom,
          attribution: layer.attribution,
        },
      ]),
    ),
    layers: [
      ...EMPTY_STYLE.layers,
      ...layers.map((_, index) => ({
        id: `${base}-${index}`,
        type: "raster" as const,
        source: `${base}-${index}`,
      })),
    ],
  };
}

const metresPerPixel = (lat: number, zoom: number) =>
  (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);

const zoomFor = (lat: number, sizeKm: number, squarePx: number) =>
  Math.log2(
    (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180) * squarePx) / (512 * sizeKm * 1000),
  );

/**
 * A map under a fixed square. Dragging moves the plate; pinching or the size
 * slider changes how much ground the square covers.
 */
export default function AreaPicker({
  lat,
  lon,
  sizeKm,
  base,
  onBaseChange,
  onChange,
}: AreaPickerProps) {
  const { t, lang } = useI18n();
  const [google, setGoogle] = useState<boolean | null>(null);
  const [copyright, setCopyright] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onChangeRef = useRef(onChange);
  const reportedSizeRef = useRef(sizeKm);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const squarePx = () => squareRef.current?.getBoundingClientRect().width || 240;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      // The real style follows once we know whether Google tiles are available.
      style: EMPTY_STYLE,
      center: [lon, lat],
      zoom: zoomFor(lat, sizeKm, squarePx()),
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    const report = () => {
      const center = map.getCenter();
      const size = roundSize((squarePx() * metresPerPixel(center.lat, map.getZoom())) / 1000);
      reportedSizeRef.current = size;
      onChangeRef.current({ lat: center.lat, lon: center.lng, sizeKm: size });
    };
    map.on("moveend", report);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    googleEnabled().then((enabled) => !cancelled && setGoogle(enabled));
    return () => {
      cancelled = true;
    };
  }, []);

  const usesGoogle = google === true && base !== "terrain";

  useEffect(() => {
    if (google === null) return;
    mapRef.current?.setStyle(styleFor(base, google, lang));
  }, [base, google, lang]);

  // Google asks for the copyright of what is on screen, kept up to date.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !usesGoogle) return;
    const type = base === "map" ? "roadmap" : "satellite";
    let controller: AbortController | undefined;
    const update = () => {
      controller?.abort();
      controller = new AbortController();
      const bounds = map.getBounds();
      const query = new URLSearchParams({
        t: type,
        l: lang,
        r: String(dpr),
        viewport: "1",
        zoom: String(Math.round(map.getZoom())),
        n: bounds.getNorth().toFixed(6),
        s: bounds.getSouth().toFixed(6),
        e: bounds.getEast().toFixed(6),
        w: bounds.getWest().toFixed(6),
      });
      fetch(`/api/google?${query}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { copyright: "" }))
        .then((data: { copyright?: string }) => setCopyright(data.copyright ?? ""))
        .catch(() => undefined);
    };
    update();
    map.on("moveend", update);
    return () => {
      controller?.abort();
      map.off("moveend", update);
    };
  }, [usesGoogle, base, lang]);

  // The size slider zooms the map so the square covers the chosen distance.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || Math.abs(reportedSizeRef.current - sizeKm) < 0.05) return;
    reportedSizeRef.current = sizeKm;
    map.easeTo({ zoom: zoomFor(map.getCenter().lat, sizeKm, squarePx()), duration: 250 });
  }, [sizeKm]);

  // A search result or "Surprise me" moves the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    if (Math.abs(center.lat - lat) < 1e-5 && Math.abs(center.lng - lon) < 1e-5) return;
    map.jumpTo({ center: [lon, lat], zoom: zoomFor(lat, sizeKm, squarePx()) });
    // Only a new place should move the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon]);

  const locate = () => {
    if (!navigator.geolocation) return notify(t("plate.locateFailed"), { tone: "error" });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        mapRef.current?.flyTo({ center: [coords.longitude, coords.latitude], duration: 800 });
      },
      () => {
        setLocating(false);
        notify(t("plate.locateFailed"), { tone: "error" });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="area-picker">
      <div ref={containerRef} className="area-picker__map" />
      <div ref={squareRef} className="area-picker__square" aria-hidden="true">
        <span className="area-picker__size">{sizeKm} km</span>
      </div>
      <div className="area-picker__bases" role="group" aria-label={t("plate.baseMap")}>
        {PICKER_BASES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={base === option}
            onClick={() => onBaseChange(option)}
          >
            {t(`plate.base.${option}` as TranslationKey)}
          </button>
        ))}
      </div>
      {usesGoogle && (
        <p className="area-picker__credit">
          <strong>Google</strong>
          {copyright && <span> · {copyright}</span>}
        </p>
      )}
      <button
        type="button"
        className="area-picker__locate"
        onClick={locate}
        aria-label={t("plate.locate")}
        aria-busy={locating}
      >
        {locating ? <span className="plate-spinner" /> : <LocateFixed size={20} />}
      </button>
    </div>
  );
}
