import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  posterReducer,
  type PosterState,
  type PosterAction,
  type PosterForm,
} from "@/context/posterReducer";
import { INITIAL_STATE } from "@/context/posterDefaults";
import { getTheme } from "@/services/theme/themeRepository";
import type { ResolvedTheme } from "@/services/theme/types";
import { applyThemeColorOverrides } from "@/services/theme/colorPaths";
import { generateMapStyle } from "@/services/map/maplibreStyle";
import { useGeolocation } from "@/hooks/useGeolocation";
import { loadDraft, saveDraft } from "@/context/posterDraft";
import { linkSetsLocation } from "@/services/share/posterLink";
import type { StyleSpecification } from "maplibre-gl";
import type { MapInstanceRef } from "@/services/map/types";
import { loadCustomMarkerIcons, saveCustomMarkerIcons } from "@/services/markers/customIconStorage";

const MAP_LAYER_KEYS = [
  "includeLandcover",
  "includeBuildings",
  "includeWater",
  "includeParks",
  "includeAeroway",
  "includeRail",
  "includeRoads",
  "includeRoadPath",
  "includeRoadMinorLow",
  "includeRoadOutline",
  "focusCountry",
] as const;

function buildMapStyleOpts(form: PosterForm, distanceKey: "distance" | "distance2") {
  return {
    ...Object.fromEntries(MAP_LAYER_KEYS.map((k) => [k, form[k as keyof PosterForm]])),
    distanceMeters: Number(form[distanceKey] || form.distance),
    tileProvider: form.tileProvider,
  } as Parameters<typeof generateMapStyle>[1];
}

interface PosterCtxValue {
  state: PosterState;
  dispatch: React.Dispatch<PosterAction>;
  selectedTheme: ResolvedTheme;
  selectedTheme2: ResolvedTheme;
  effectiveTheme: ResolvedTheme;
  effectiveTheme2: ResolvedTheme;
  mapStyle: StyleSpecification;
  mapStyle2: StyleSpecification;
  mapRef: MapInstanceRef;
  mapRef2: MapInstanceRef;
}

const PosterContext = createContext<PosterCtxValue | null>(null);
const DispatchContext = createContext<{ dispatch: React.Dispatch<PosterAction> } | null>(null);

export function PosterProvider({ children }: { children: ReactNode }) {
  // A saved draft or a shared link already says where the poster is, so only a
  // brand-new design asks the browser for the visitor's position.
  const [initial] = useState(() => {
    const draft = loadDraft(INITIAL_STATE);
    return {
      state: draft ?? INITIAL_STATE,
      autoLocate: !draft && !linkSetsLocation(window.location.search),
    };
  });
  const [state, dispatch] = useReducer(posterReducer, initial.state);
  const mapRef = useRef(null) as MapInstanceRef;
  const mapRef2 = useRef(null) as MapInstanceRef;
  const lastThemeTextRef = useRef<string | null>(null);
  const iconsLoadedRef = useRef(false);

  useGeolocation(dispatch, initial.autoLocate);

  const selectedTheme = useMemo(() => getTheme(state.form.theme), [state.form.theme]);
  const selectedTheme2 = useMemo(
    () => getTheme(state.form.theme2 || state.form.theme),
    [state.form.theme2, state.form.theme],
  );
  const hasCustomColors = Object.keys(state.customColors).length > 0;
  const effectiveTheme = useMemo(
    () =>
      hasCustomColors ? applyThemeColorOverrides(selectedTheme, state.customColors) : selectedTheme,
    [hasCustomColors, selectedTheme, state.customColors],
  );
  const effectiveTheme2 = useMemo(
    () =>
      hasCustomColors
        ? applyThemeColorOverrides(selectedTheme2, state.customColors)
        : selectedTheme2,
    [hasCustomColors, selectedTheme2, state.customColors],
  );

  // Recolour markers & routes when the theme's text colour changes. The first
  // run only records the colour so a restored draft keeps its own colours.
  useEffect(() => {
    const color = effectiveTheme.ui.text;
    const previous = lastThemeTextRef.current;
    lastThemeTextRef.current = color;
    if (previous === null || previous === color) return;
    dispatch({ type: "SET_MARKER_DEFAULTS", defaults: { color }, applyToMarkers: true });
    dispatch({ type: "SET_ROUTE_DEFAULTS", defaults: { color }, applyToRoutes: true });
  }, [effectiveTheme.ui.text]);

  const { form, customColors, markers, routes, markerDefaults, routeDefaults } = state;
  useEffect(() => {
    const timer = window.setTimeout(
      () => saveDraft({ form, customColors, markers, routes, markerDefaults, routeDefaults }),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [form, customColors, markers, routes, markerDefaults, routeDefaults]);

  // Load/save custom marker icons
  useEffect(() => {
    let cancelled = false;
    void loadCustomMarkerIcons()
      .then((icons) => {
        if (!cancelled) {
          iconsLoadedRef.current = true;
          dispatch({ type: "SET_CUSTOM_MARKER_ICONS", icons });
        }
      })
      .catch(() => {
        iconsLoadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (iconsLoadedRef.current) void saveCustomMarkerIcons(state.customMarkerIcons).catch(() => {});
  }, [state.customMarkerIcons]);

  const mapStyleOpts = useMemo(
    () => buildMapStyleOpts(state.form, "distance"),
    [
      state.form.includeLandcover,
      state.form.includeBuildings,
      state.form.includeWater,
      state.form.includeParks,
      state.form.includeAeroway,
      state.form.includeRail,
      state.form.includeRoads,
      state.form.includeRoadPath,
      state.form.includeRoadMinorLow,
      state.form.includeRoadOutline,
      state.form.focusCountry,
      state.form.distance,
      state.form.tileProvider,
    ],
  );

  const mapStyleOpts2 = useMemo(
    () => buildMapStyleOpts(state.form, "distance2"),
    [
      state.form.includeLandcover,
      state.form.includeBuildings,
      state.form.includeWater,
      state.form.includeParks,
      state.form.includeAeroway,
      state.form.includeRail,
      state.form.includeRoads,
      state.form.includeRoadPath,
      state.form.includeRoadMinorLow,
      state.form.includeRoadOutline,
      state.form.focusCountry,
      state.form.distance2,
      state.form.distance,
      state.form.tileProvider,
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
    () => ({
      state,
      dispatch,
      selectedTheme,
      selectedTheme2,
      effectiveTheme,
      effectiveTheme2,
      mapStyle,
      mapStyle2,
      mapRef,
      mapRef2,
    }),
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
