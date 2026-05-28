import type { SearchResult } from "@/features/location/domain/types";
import type { MarkerDefaults, MarkerIconDefinition, MarkerItem } from "@/features/markers/domain/types";
import { MAX_MARKER_SIZE, MIN_MARKER_SIZE } from "@/features/markers/domain/constants";
import { createDefaultMarkerSettings } from "@/features/markers/infrastructure/helpers";
import { featuredMarkerIcons } from "@/features/markers/infrastructure/iconRegistry";
import { clamp } from "@/shared/geo/math";
import type { Route, RouteDefaults } from "@/features/routes/domain/types";
import { MAX_ROUTE_OPACITY, MAX_ROUTE_STROKE_WIDTH, MIN_ROUTE_OPACITY, MIN_ROUTE_STROKE_WIDTH } from "@/features/routes/domain/constants";

export interface PosterForm {
  location: string; latitude: string; longitude: string; distance: string;
  width: string; height: string; theme: string; theme2: string; layout: string;
  displayCity: string; displayCountry: string; displayContinent: string;
  footerCity: string; footerCountry: string; fontFamily: string;
  showPosterText: boolean; includeCredits: boolean; includeLandcover: boolean;
  includeBuildings: boolean; includeWater: boolean; includeParks: boolean;
  includeAeroway: boolean; includeRail: boolean; includeRoads: boolean;
  includeRoadPath: boolean; includeRoadMinorLow: boolean; includeRoadOutline: boolean;
  tileProvider: string; mapShape: string; footerStyle: string;
  showBorder: boolean; showCoordinates: boolean; showUnderline: boolean;
  titleAllCaps: boolean; showMarkers: boolean; showRoutes: boolean;
  showQrCode: boolean; qrDestination: string; qrCustomUrl: string; qrPosition: string;
  logoUrl: string; logoPosition: string; radiusMeters: string; showPois: boolean;
  appTheme: string; uiDensity: string;
  qrSize: string; qrOpacity: string; qrPadding: string;
  logoSize: string; logoOpacity: string; logoPadding: string;
  qrPhone: string; qrX: string; qrY: string; logoX: string; logoY: string; qrLabel: string;
  letterSpacing: string; titleAlign: string; coordsFormat: string; layoutMode: string;
  location2: string; latitude2: string; longitude2: string; distance2: string;
  displayCity2: string; displayCountry2: string; displayContinent2: string;
  propType: string; propPrice: string; propLandSize: string; propBuildSize: string;
  propContact: string; propAgent: string; propCta: string; propFeatures: string;
  propStatus: string; propBedrooms: string; propBathrooms: string; propWebsite: string; propAgentLogo: string;
  shopOpen: string; shopTagline: string; shopInstagram: string; shopFacebook: string;
  shopTelegram: string; shopWhatsapp: string; shopPhone: string;
  snapToRoads: boolean; poiSchools: boolean; poiHospitals: boolean;
  poiMarkets: boolean; poiBanks: boolean; poiRestaurants: boolean;
  focusCountry: boolean; radiusLabel: string; radiusStyle: string;
}

export interface PosterState {
  form: PosterForm;
  customColors: Record<string, string>;
  markers: MarkerItem[];
  customMarkerIcons: MarkerIconDefinition[];
  markerDefaults: MarkerDefaults;
  isMarkerEditorActive: boolean;
  activeMarkerId: string | null;
  routeDrawMode: boolean;
  routeEditMode: boolean;
  routes: Route[];
  routeDefaults: RouteDefaults;
  error: string;
  isExporting: boolean;
  isLocationFocused: boolean;
  selectedLocation: SearchResult | null;
  userLocation: SearchResult | null;
  displayNameOverrides: { city: boolean; country: boolean };
}

export type PosterAction =
  | { type: "SET_FIELD"; name: string; value: string | boolean }
  | { type: "SET_FORM_FIELDS"; fields: Partial<PosterForm>; resetDisplayNameOverrides?: boolean }
  | { type: "SET_THEME"; themeId: string }
  | { type: "SET_THEME2"; themeId: string }
  | { type: "SET_LAYOUT"; layoutId: string; widthCm: string; heightCm: string }
  | { type: "SET_COLOR"; key: string; value: string }
  | { type: "RESET_COLORS" }
  | { type: "SELECT_LOCATION"; location: SearchResult }
  | { type: "SET_USER_LOCATION"; location: SearchResult | null }
  | { type: "CLEAR_LOCATION" }
  | { type: "SET_LOCATION_FOCUSED"; focused: boolean }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_EXPORT_STATUS"; exporting: boolean; error?: string }
  | { type: "SET_MARKER_EDITOR_ACTIVE"; active: boolean }
  | { type: "SET_ROUTE_DRAW_MODE"; active: boolean }
  | { type: "SET_ROUTE_EDIT_MODE"; active: boolean }
  | { type: "SET_ACTIVE_MARKER"; markerId: string | null }
  | { type: "ADD_MARKER"; marker: MarkerItem }
  | { type: "UPDATE_MARKER"; markerId: string; changes: Partial<MarkerItem> }
  | { type: "REMOVE_MARKER"; markerId: string }
  | { type: "CLEAR_MARKERS" }
  | { type: "ADD_CUSTOM_MARKER_ICON"; icon: MarkerIconDefinition }
  | { type: "SET_CUSTOM_MARKER_ICONS"; icons: MarkerIconDefinition[] }
  | { type: "REMOVE_CUSTOM_MARKER_ICON"; iconId: string }
  | { type: "CLEAR_CUSTOM_MARKER_ICONS" }
  | { type: "SET_MARKER_DEFAULTS"; defaults: Partial<MarkerDefaults>; applyToMarkers?: boolean }
  | { type: "RESET_MARKER_DEFAULTS" }
  | { type: "ADD_ROUTE"; route: Route }
  | { type: "UPDATE_ROUTE"; routeId: string; changes: Partial<Route> }
  | { type: "REMOVE_ROUTE"; routeId: string }
  | { type: "REPLACE_ROUTES"; routes: Route[] }
  | { type: "CLEAR_ROUTES" }
  | { type: "SET_ROUTE_DEFAULTS"; defaults: Partial<RouteDefaults>; applyToRoutes?: boolean };

const COORD_FIELDS = new Set(["location", "latitude", "longitude"]);

// ─── Branch helpers ────────────────────────────────────────────────────────

/**
 * Applies a partial update to a single marker, enforcing the clamped `size`
 * constraint and preserving the immutable `id`.
 */
function applyMarkerUpdate(
  markers: MarkerItem[],
  markerId: string,
  changes: Partial<MarkerItem>,
): MarkerItem[] {
  return markers.map(m => {
    if (m.id !== markerId) return m;
    return {
      ...m,
      ...changes,
      id: m.id,
      size:
        typeof changes.size === "number"
          ? clamp(changes.size, MIN_MARKER_SIZE, MAX_MARKER_SIZE)
          : m.size,
    };
  });
}

/**
/**
 * Validates and applies a partial `MarkerDefaults` update, clamping `size` and
 * filtering out blank `color` values.
 */
function applyMarkerDefaults(
  current: MarkerDefaults,
  incoming: Partial<MarkerDefaults>,
): MarkerDefaults {
  const hasSize = typeof incoming.size === "number" && Number.isFinite(incoming.size);
  const hasColor = typeof incoming.color === "string" && incoming.color.trim().length > 0;
  return {
    ...current,
    ...(hasSize ? { size: clamp(incoming.size!, MIN_MARKER_SIZE, MAX_MARKER_SIZE) } : {}),
    ...(hasColor ? { color: incoming.color! } : {}),
  };
}

/**
 * Removes one or all custom marker icons, re-assigning any affected markers to
 * the built-in fallback icon.
 */
function applyIconRemoval(
  markers: MarkerItem[],
  customMarkerIcons: MarkerIconDefinition[],
  removedIds: Set<string>,
): { markers: MarkerItem[]; customMarkerIcons: MarkerIconDefinition[] } {
  const fallback = featuredMarkerIcons[0]?.id ?? "pin";
  return {
    customMarkerIcons: customMarkerIcons.filter(i => !removedIds.has(i.id)),
    markers: markers.map(m => (removedIds.has(m.iconId) ? { ...m, iconId: fallback } : m)),
  };
}

/**
 * Applies a partial update to a single route, enforcing clamped `strokeWidth`
 * and `opacity` constraints and preserving the immutable `id`.
 */
function applyRouteUpdate(
  routes: Route[],
  routeId: string,
  changes: Partial<Route>,
): Route[] {
  return routes.map(r => {
    if (r.id !== routeId) return r;
    return {
      ...r,
      ...changes,
      id: r.id,
      segments: changes.segments ?? r.segments,
      strokeWidth:
        typeof changes.strokeWidth === "number"
          ? clamp(changes.strokeWidth, MIN_ROUTE_STROKE_WIDTH, MAX_ROUTE_STROKE_WIDTH)
          : r.strokeWidth,
      opacity:
        typeof changes.opacity === "number"
          ? clamp(changes.opacity, MIN_ROUTE_OPACITY, MAX_ROUTE_OPACITY)
          : r.opacity,
    };
  });
}

export function posterReducer(state: PosterState, action: PosterAction): PosterState {
  switch (action.type) {
    case "SET_FIELD": {
      const overrides = { ...state.displayNameOverrides };
      if (COORD_FIELDS.has(action.name)) { overrides.city = overrides.country = false; }
      if (action.name === "displayCity") overrides.city = true;
      if (action.name === "displayCountry") overrides.country = true;
      return {
        ...state,
        form: { ...state.form, [action.name]: action.value },
        displayNameOverrides: overrides,
        ...(COORD_FIELDS.has(action.name) ? { selectedLocation: null } : {}),
      };
    }
    case "SET_FORM_FIELDS":
      return {
        ...state,
        form: { ...state.form, ...action.fields },
        displayNameOverrides: action.resetDisplayNameOverrides ? { city: false, country: false } : state.displayNameOverrides,
      };
    case "SET_THEME": return { ...state, form: { ...state.form, theme: action.themeId }, customColors: {} };
    case "SET_THEME2": return { ...state, form: { ...state.form, theme2: action.themeId } };
    case "SET_LAYOUT": return { ...state, form: { ...state.form, layout: action.layoutId, width: action.widthCm, height: action.heightCm } };
    case "SET_COLOR": return { ...state, customColors: { ...state.customColors, [action.key]: action.value } };
    case "RESET_COLORS": return { ...state, customColors: {} };
    case "SELECT_LOCATION": {
      const city = action.location.shortLabel || action.location.city;
      return {
        ...state,
        selectedLocation: action.location,
        isLocationFocused: false,
        displayNameOverrides: { city: false, country: false },
        form: {
          ...state.form,
          location: action.location.label,
          latitude: action.location.lat.toFixed(6),
          longitude: action.location.lon.toFixed(6),
          displayCity: city,
          displayCountry: action.location.country,
          displayContinent: action.location.continent ?? "",
          footerCity: city,
          footerCountry: action.location.country,
        },
      };
    }
    case "SET_USER_LOCATION": return { ...state, userLocation: action.location };
    case "CLEAR_LOCATION":
      return {
        ...state,
        selectedLocation: null,
        displayNameOverrides: { city: false, country: false },
        form: { ...state.form, location: "", displayCity: "", displayCountry: "", displayContinent: "", footerCity: "", footerCountry: "" },
      };
    case "SET_LOCATION_FOCUSED": return { ...state, isLocationFocused: action.focused };
    case "SET_ERROR": return { ...state, error: action.error };
    case "SET_EXPORT_STATUS": return { ...state, isExporting: action.exporting, error: action.exporting ? "" : (action.error ?? state.error) };
    case "SET_MARKER_EDITOR_ACTIVE": return { ...state, isMarkerEditorActive: action.active, activeMarkerId: action.active ? state.activeMarkerId : null };
    case "SET_ROUTE_DRAW_MODE": return { ...state, routeDrawMode: action.active };
    case "SET_ROUTE_EDIT_MODE": return { ...state, routeEditMode: action.active };
    case "SET_ACTIVE_MARKER": return { ...state, activeMarkerId: action.markerId };
    case "ADD_MARKER": return { ...state, markers: [...state.markers, action.marker] };
    case "UPDATE_MARKER":
      return { ...state, markers: applyMarkerUpdate(state.markers, action.markerId, action.changes) };
    case "REMOVE_MARKER":
      return { ...state, markers: state.markers.filter(m => m.id !== action.markerId), activeMarkerId: state.activeMarkerId === action.markerId ? null : state.activeMarkerId };
    case "CLEAR_MARKERS": return { ...state, markers: [], activeMarkerId: null, isMarkerEditorActive: false };
    case "ADD_CUSTOM_MARKER_ICON": return { ...state, customMarkerIcons: [...state.customMarkerIcons, action.icon] };
    case "SET_CUSTOM_MARKER_ICONS": return { ...state, customMarkerIcons: action.icons };
    case "REMOVE_CUSTOM_MARKER_ICON": {
      const removed = applyIconRemoval(state.markers, state.customMarkerIcons, new Set([action.iconId]));
      return { ...state, ...removed };
    }
    case "CLEAR_CUSTOM_MARKER_ICONS": {
      const allCustomIds = new Set(state.customMarkerIcons.map(i => i.id));
      const removed = applyIconRemoval(state.markers, state.customMarkerIcons, allCustomIds);
      return { ...state, ...removed };
    }
    case "SET_MARKER_DEFAULTS": {
      const next = applyMarkerDefaults(state.markerDefaults, action.defaults);
      const hasSize = next.size !== state.markerDefaults.size;
      const hasColor = next.color !== state.markerDefaults.color;
      return {
        ...state,
        markerDefaults: next,
        markers: action.applyToMarkers
          ? state.markers.map(m => ({ ...m, ...(hasSize ? { size: next.size } : {}), ...(hasColor ? { color: next.color } : {}) }))
          : state.markers,
      };
    }
    case "RESET_MARKER_DEFAULTS": {
      const d = createDefaultMarkerSettings();
      return { ...state, markerDefaults: d, markers: state.markers.map(m => ({ ...m, size: d.size, color: d.color })) };
    }
    case "ADD_ROUTE": return { ...state, routes: [...state.routes, action.route] };
    case "UPDATE_ROUTE":
      return { ...state, routes: applyRouteUpdate(state.routes, action.routeId, action.changes) };
    case "REMOVE_ROUTE": return { ...state, routes: state.routes.filter(r => r.id !== action.routeId) };
    case "REPLACE_ROUTES": return { ...state, routes: action.routes };
    case "CLEAR_ROUTES": return { ...state, routes: [] };
    case "SET_ROUTE_DEFAULTS": {
      const { defaults: d, applyToRoutes } = action;
      const next: RouteDefaults = {
        color: d.color ?? state.routeDefaults.color,
        strokeWidth: typeof d.strokeWidth === "number" ? clamp(d.strokeWidth, MIN_ROUTE_STROKE_WIDTH, MAX_ROUTE_STROKE_WIDTH) : state.routeDefaults.strokeWidth,
        opacity: typeof d.opacity === "number" ? clamp(d.opacity, MIN_ROUTE_OPACITY, MAX_ROUTE_OPACITY) : state.routeDefaults.opacity,
        lineStyle: d.lineStyle ?? state.routeDefaults.lineStyle,
        startIconId: d.startIconId ?? state.routeDefaults.startIconId,
        finishIconId: d.finishIconId ?? state.routeDefaults.finishIconId,
      };
      return {
        ...state,
        routeDefaults: next,
        routes: applyToRoutes ? state.routes.map(r => ({ ...r, color: next.color, strokeWidth: next.strokeWidth, opacity: next.opacity, lineStyle: next.lineStyle })) : state.routes,
      };
    }
    default: return state;
  }
}
