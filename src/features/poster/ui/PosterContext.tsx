import { createContext, useContext, useEffect, useReducer, useMemo, useRef, type ReactNode } from "react";
import { posterReducer, type PosterState, type PosterAction, type PosterForm } from "../application/posterReducer";
import type { ResolvedTheme } from "@/features/theme/domain/types";
import { getTheme } from "@/features/theme/infrastructure/themeRepository";
import { applyThemeColorOverrides } from "@/features/theme/domain/colorPaths";
import { generateMapStyle } from "@/features/map/infrastructure/maplibreStyle";
import { useGeolocation } from "@/features/map/application/useGeolocation";
import type { StyleSpecification } from "maplibre-gl";
import type { MapInstanceRef } from "@/features/map/domain/types";
import { createDefaultMarkerSettings } from "@/features/markers/infrastructure/helpers";
import { loadCustomMarkerIcons, saveCustomMarkerIcons } from "@/features/markers/infrastructure/customIconStorage";
import { createDefaultRouteSettings } from "@/features/routes/infrastructure/helpers";
import { defaultLayoutId, getLayoutOption } from "@/features/layout/infrastructure/layoutRepository";
import { defaultThemeName } from "@/features/theme/infrastructure/themeRepository";
import { DEFAULT_POSTER_WIDTH_CM, DEFAULT_POSTER_HEIGHT_CM, DEFAULT_DISTANCE_METERS, DEFAULT_LAT, DEFAULT_LON } from "@/core/config";

const defaultLayout = getLayoutOption(defaultLayoutId);

export const DEFAULT_FORM: PosterForm = {
  location: "Phnom Penh, Cambodia",
  latitude: DEFAULT_LAT.toFixed(6), longitude: DEFAULT_LON.toFixed(6),
  distance: String(DEFAULT_DISTANCE_METERS),
  width: String(Number(defaultLayout?.widthCm ?? DEFAULT_POSTER_WIDTH_CM)),
  height: String(Number(defaultLayout?.heightCm ?? DEFAULT_POSTER_HEIGHT_CM)),
  theme: defaultThemeName, theme2: defaultThemeName, layout: defaultLayoutId,
  displayCity: "Phnom Penh", displayCountry: "Cambodia", displayContinent: "Asia",
  footerCity: "Phnom Penh", footerCountry: "Cambodia",
  fontFamily: "Bebas Neue",
  showPosterText: true, includeCredits: true, includeLandcover: true,
  includeBuildings: true, includeWater: true, includeParks: true,
  includeAeroway: true, includeRail: true, includeRoads: true,
  includeRoadPath: true, includeRoadMinorLow: true, includeRoadOutline: true,
  tileProvider: "openfreemap", mapShape: "rectangle", footerStyle: "solid",
  showBorder: true, showCoordinates: true, showUnderline: true,
  titleAllCaps: false, showMarkers: true, showRoutes: true,
  showQrCode: false, qrDestination: "google-maps", qrCustomUrl: "", qrPosition: "bottom-right",
  logoUrl: "", logoPosition: "top-right", radiusMeters: "0", showPois: false,
  appTheme: "dark", uiDensity: "comfortable",
  qrSize: "12", qrOpacity: "100", qrPadding: "6",
  logoSize: "25", logoOpacity: "100", logoPadding: "0",
  qrPhone: "", qrX: "92", qrY: "92", logoX: "92", logoY: "10", qrLabel: "",
  letterSpacing: "0", titleAlign: "center", coordsFormat: "decimal", layoutMode: "poster",
  location2: "Paris, France", latitude2: "48.8566", longitude2: "2.3522",
  distance2: String(DEFAULT_DISTANCE_METERS),
  displayCity2: "Paris", displayCountry2: "France", displayContinent2: "Europe",
  propType: "Villa", propPrice: "$185,000", propLandSize: "200m²", propBuildSize: "150m²",
  propContact: "+855 12 345 678", propAgent: "Agent Name", propCta: "Call Now",
  propFeatures: "3 Bed • 2 Bath • Pool", propStatus: "For Sale",
  propBedrooms: "3", propBathrooms: "2", propWebsite: "", propAgentLogo: "",
  shopOpen: "7AM – 8PM daily", shopTagline: "Your neighborhood store",
  shopInstagram: "", shopFacebook: "", shopTelegram: "", shopWhatsapp: "", shopPhone: "+855 12 345 678",
  snapToRoads: true, poiSchools: false, poiHospitals: false, poiMarkets: false, poiBanks: false, poiRestaurants: false, focusCountry: false,
  radiusLabel: "5 min walk", radiusStyle: "dashed",
};

const defaultTheme = getTheme(defaultThemeName);
const INITIAL_STATE: PosterState = {
  form: DEFAULT_FORM, customColors: {},
  markers: [], customMarkerIcons: [],
  markerDefaults: { ...createDefaultMarkerSettings(), color: defaultTheme.ui.text },
  isMarkerEditorActive: false, routeDrawMode: false, routeEditMode: false,
  activeMarkerId: null, routes: [],
  routeDefaults: { ...createDefaultRouteSettings(), color: defaultTheme.ui.text },
  error: "", isExporting: false, isLocationFocused: false,
  selectedLocation: null, userLocation: null,
  displayNameOverrides: { city: false, country: false },
};

const MAP_LAYER_KEYS = [
  "includeLandcover", "includeBuildings", "includeWater", "includeParks",
  "includeAeroway", "includeRail", "includeRoads", "includeRoadPath",
  "includeRoadMinorLow", "includeRoadOutline", "focusCountry",
] as const;

function buildMapStyleOpts(form: PosterForm, distanceKey: "distance" | "distance2") {
  return {
    ...Object.fromEntries(MAP_LAYER_KEYS.map(k => [k, form[k as keyof PosterForm]])),
    distanceMeters: Number(form[distanceKey] || form.distance),
    tileProvider: form.tileProvider,
  } as Parameters<typeof generateMapStyle>[1];
}

interface PosterCtxValue {
  state: PosterState; dispatch: React.Dispatch<PosterAction>;
  selectedTheme: ResolvedTheme; selectedTheme2: ResolvedTheme;
  effectiveTheme: ResolvedTheme; effectiveTheme2: ResolvedTheme;
  mapStyle: StyleSpecification; mapStyle2: StyleSpecification;
  mapRef: MapInstanceRef; mapRef2: MapInstanceRef;
}

const PosterContext = createContext<PosterCtxValue | null>(null);
const DispatchContext = createContext<{ dispatch: React.Dispatch<PosterAction> } | null>(null);

export function PosterProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(posterReducer, INITIAL_STATE);
  const mapRef = useRef(null) as MapInstanceRef;
  const mapRef2 = useRef(null) as MapInstanceRef;
  const lastMarkerColorRef = useRef<string | null>(null);
  const lastRouteColorRef = useRef<string | null>(null);
  const iconsLoadedRef = useRef(false);

  useGeolocation(dispatch);

  const selectedTheme = useMemo(() => getTheme(state.form.theme), [state.form.theme]);
  const selectedTheme2 = useMemo(() => getTheme(state.form.theme2 || state.form.theme), [state.form.theme2, state.form.theme]);
  const hasCustomColors = Object.keys(state.customColors).length > 0;
  const effectiveTheme = useMemo(() => hasCustomColors ? applyThemeColorOverrides(selectedTheme, state.customColors) : selectedTheme, [selectedTheme, state.customColors]);
  const effectiveTheme2 = useMemo(() => hasCustomColors ? applyThemeColorOverrides(selectedTheme2, state.customColors) : selectedTheme2, [selectedTheme2, state.customColors]);

  // Sync theme color → markers & routes
  useEffect(() => {
    const c = effectiveTheme.ui.text;
    if (lastMarkerColorRef.current === c) return;
    lastMarkerColorRef.current = c;
    dispatch({ type: "SET_MARKER_DEFAULTS", defaults: { color: c }, applyToMarkers: true });
  }, [effectiveTheme.ui.text]);

  useEffect(() => {
    const c = effectiveTheme.ui.text;
    if (lastRouteColorRef.current === c) return;
    lastRouteColorRef.current = c;
    dispatch({ type: "SET_ROUTE_DEFAULTS", defaults: { color: c }, applyToRoutes: true });
  }, [effectiveTheme.ui.text]);

  // Load/save custom marker icons
  useEffect(() => {
    let cancelled = false;
    void loadCustomMarkerIcons().then(icons => {
      if (!cancelled) { iconsLoadedRef.current = true; dispatch({ type: "SET_CUSTOM_MARKER_ICONS", icons }); }
    }).catch(() => { iconsLoadedRef.current = true; });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (iconsLoadedRef.current) void saveCustomMarkerIcons(state.customMarkerIcons).catch(() => {});
  }, [state.customMarkerIcons]);

  const mapStyleOpts = useMemo(
    () => buildMapStyleOpts(state.form, "distance"),
    [
      state.form.includeLandcover, state.form.includeBuildings, state.form.includeWater,
      state.form.includeParks, state.form.includeAeroway, state.form.includeRail,
      state.form.includeRoads, state.form.includeRoadPath, state.form.includeRoadMinorLow,
      state.form.includeRoadOutline, state.form.focusCountry, state.form.distance, state.form.tileProvider,
    ],
  );

  const mapStyleOpts2 = useMemo(
    () => buildMapStyleOpts(state.form, "distance2"),
    [
      state.form.includeLandcover, state.form.includeBuildings, state.form.includeWater,
      state.form.includeParks, state.form.includeAeroway, state.form.includeRail,
      state.form.includeRoads, state.form.includeRoadPath, state.form.includeRoadMinorLow,
      state.form.includeRoadOutline, state.form.focusCountry, state.form.distance2, state.form.distance, state.form.tileProvider,
    ],
  );

  const mapStyle = useMemo(
    () => generateMapStyle(effectiveTheme, mapStyleOpts),
    [effectiveTheme, mapStyleOpts],
  );

  const mapStyle2 = useMemo(
    () => generateMapStyle(effectiveTheme2, mapStyleOpts2),
    [effectiveTheme2, mapStyleOpts2],
  );

  const dispatchValue = useMemo(() => ({ dispatch }), []);
  const value = useMemo<PosterCtxValue>(
    () => ({ state, dispatch, selectedTheme, selectedTheme2, effectiveTheme, effectiveTheme2, mapStyle, mapStyle2, mapRef, mapRef2 }),
    [state, selectedTheme, selectedTheme2, effectiveTheme, effectiveTheme2, mapStyle, mapStyle2],
  );

  return (
    <DispatchContext.Provider value={dispatchValue}>
      <PosterContext.Provider value={value}>{children}</PosterContext.Provider>
    </DispatchContext.Provider>
  );
}

export function usePosterContext(): PosterCtxValue {
  const ctx = useContext(PosterContext);
  if (!ctx) throw new Error("usePosterContext must be within PosterProvider");
  return ctx;
}

export function usePosterDispatch() {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("usePosterDispatch must be within PosterProvider");
  return ctx;
}
