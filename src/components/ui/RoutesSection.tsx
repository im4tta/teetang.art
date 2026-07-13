import { useCallback, useMemo, useState } from "react";
import { usePosterContext } from "@/context/PosterContext";
import type { Route, RouteEndpointMarker } from "@/services/routes/types";
import type { SearchResult } from "@/services/location/types";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";
import { fetchOsrmRoute } from "@/api/osrm";
import { MAX_MARKER_SIZE, MIN_MARKER_SIZE } from "@/services/markers/constants";
import { routeLengthMeters, routeBounds, boundsCenter, boundsHalfWidthMeters } from "@/services/routes/helpers";
import { ROUTE_LINE_STYLES, MAX_ROUTE_OPACITY, MAX_ROUTE_STROKE_WIDTH, MIN_ROUTE_OPACITY, MIN_ROUTE_STROKE_WIDTH } from "@/services/routes/constants";
import ColorPicker from "@/components/ui/ColorPicker";
import { buildDynamicColorChoices } from "@/services/theme/colorSuggestions";
import { DISPLAY_PALETTE_KEYS, type ThemeColorKey } from "@/services/theme/types";
import { getThemeColorByPath } from "@/services/theme/colorPaths";
import { CheckIcon, CloseIcon, TrashIcon } from "@/components/ui/Icons";
import { useI18n } from "@/context/i18n/context";
import MarkerVisual from "@/components/ui/MarkerVisual";
import { findMarkerIcon, predefinedMarkerIcons } from "@/services/markers/iconRegistry";
import type { MarkerIconDefinition } from "@/services/markers/types";

type Kind = "start" | "finish";
const fmtDist = (m: number) => !Number.isFinite(m) || m <= 0 ? "—" : m < 1000 ? `${Math.round(m)} m` : m < 10000 ? `${(m / 1000).toFixed(2)} km` : `${(m / 1000).toFixed(1)} km`;

// ─── LocationInput ────────────────────────────────────────────────────────────

interface LocationInputProps {
  label: string;
  value: string;
  focused: boolean;
  suggestions: SearchResult[];
  searching: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSelect: (s: SearchResult) => void;
  onUseCurrentLocation: () => void;
}

function LocationInput({
  label,
  value,
  focused: _focused,
  suggestions,
  searching,
  onChange,
  onFocus,
  onBlur,
  onSelect,
  onUseCurrentLocation,
}: LocationInputProps) {
  const { t } = useI18n();
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 11, color: "#94a3b8" }}>{label}</label>
        <button type="button" style={{ fontSize: 10, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={onUseCurrentLocation}>{t("routes.useCurrentLocation")}</button>
      </div>
      <input type="text" className="ios-input" value={value} onChange={onChange} onFocus={onFocus} onBlur={() => setTimeout(onBlur, 200)} />
      {(searching || suggestions.length > 0) && (
        <div className="location-suggestions" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20 }}>
          {searching ? <div className="location-suggestions__item">Searching…</div> : suggestions.map((s) => (
            <button key={`${s.lat}-${s.lon}`} type="button" className="location-suggestions__item" onMouseDown={e => e.preventDefault()} onClick={() => onSelect(s)}>
              {s.label}{s.city && <span className="location-suggestions__sub">{s.city}, {s.country}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EndpointEditor ───────────────────────────────────────────────────────────

interface EndpointEditorProps {
  routeId: string;
  epKind: Kind;
  ep: RouteEndpointMarker;
  routeColor: string;
  palette: string[];
  customMarkerIcons: MarkerIconDefinition[];
  onUpdateEP: (routeId: string, kind: Kind, changes: Partial<RouteEndpointMarker>) => void;
}

function EndpointEditor({
  routeId,
  epKind,
  ep,
  routeColor,
  palette,
  customMarkerIcons,
  onUpdateEP,
}: EndpointEditorProps) {
  const [epIconOpen, setEpIconOpen] = useState(false);
  const [epColorOpen, setEpColorOpen] = useState(false);

  const icon = findMarkerIcon(ep.iconId, customMarkerIcons);
  const epColors = buildDynamicColorChoices(ep.color, palette);

  return (
    <div className="route-card__body">
      <div className="route-card__field">
        <label>
          <span>Icon</span>
          <button type="button" className="route-card__endpoint-toggle" onClick={() => setEpIconOpen(p => !p)}>
            {icon && <MarkerVisual icon={icon} size={22} color={ep.color} />}
          </button>
        </label>
        {epIconOpen && (
          <div className="route-card__endpoint-picker">
            {predefinedMarkerIcons.map(o => (
              <button
                key={o.id}
                type="button"
                className={`route-card__endpoint-option${o.id === ep.iconId ? " is-selected" : ""}`}
                onClick={() => onUpdateEP(routeId, epKind, { iconId: o.id })}
              >
                <MarkerVisual icon={o} size={24} color={ep.color} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="route-card__field">
        <label>
          <span>Color</span>
          <button type="button" className="route-card__color-toggle" style={{ backgroundColor: ep.color }} onClick={() => setEpColorOpen(p => !p)}>
            {epColorOpen && <CloseIcon />}
          </button>
        </label>
        {epColorOpen && (
          <ColorPicker
            currentColor={ep.color}
            suggestedColors={epColors.suggestedColors}
            moreColors={epColors.moreColors}
            onChange={c => onUpdateEP(routeId, epKind, { color: c })}
            onResetColor={() => onUpdateEP(routeId, epKind, { color: routeColor })}
          />
        )}
      </div>
      <div className="route-card__field">
        <label htmlFor={`ep-size-${routeId}-${epKind}`}>
          <span>Size</span>
          <span className="route-card__value">{ep.size}px</span>
        </label>
        <input
          id={`ep-size-${routeId}-${epKind}`}
          type="range"
          min={MIN_MARKER_SIZE}
          max={MAX_MARKER_SIZE}
          step={1}
          value={ep.size}
          onChange={e => onUpdateEP(routeId, epKind, { size: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

// ─── RouteCard ────────────────────────────────────────────────────────────────

interface RouteCardProps {
  route: Route;
  palette: string[];
  customMarkerIcons: MarkerIconDefinition[];
  routeDefaultColor: string;
  onUpdate: (routeId: string, changes: Partial<Route>) => void;
  onUpdateEP: (routeId: string, kind: Kind, changes: Partial<RouteEndpointMarker>) => void;
  onRemove: (routeId: string) => void;
}

function RouteCard({
  route,
  palette,
  customMarkerIcons,
  routeDefaultColor,
  onUpdate,
  onUpdateEP,
  onRemove,
}: RouteCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isColorOpen, setIsColorOpen] = useState(false);
  const [activeEP, setActiveEP] = useState<Kind | null>(null);

  const colorChoices = buildDynamicColorChoices(route.color, palette);
  const editingEP = activeEP !== null;

  function openCard() {
    setIsOpen(true);
    setIsColorOpen(false);
    setActiveEP(null);
  }

  function closeCard() {
    setIsOpen(false);
    setIsColorOpen(false);
    setActiveEP(null);
  }

  function toggleCard() {
    if (isOpen) closeCard();
    else openCard();
  }

  return (
    <article className={`route-card${isOpen ? " is-open" : ""}`}>
      {!isOpen
        ? <button type="button" className="route-card__delete" onClick={() => onRemove(route.id)}><CloseIcon /></button>
        : (
          <button
            type="button"
            className="route-card__done"
            onClick={editingEP ? () => setActiveEP(null) : closeCard}
          >
            <CheckIcon />
          </button>
        )}

      <button type="button" className="route-card__summary" onClick={toggleCard} aria-expanded={isOpen} disabled={editingEP}>
        <span className="route-card__swatch" style={{ backgroundColor: route.color, opacity: route.opacity }} aria-hidden="true" />
        <span className="route-card__meta">
          <span className="route-card__label">
            {editingEP ? `Edit ${activeEP === "start" ? "Start" : "Finish"}` : route.label}
          </span>
          <span className="route-card__distance">
            {editingEP ? route.label : fmtDist(routeLengthMeters(route))}
          </span>
        </span>
      </button>

      {isOpen && editingEP && (
        <EndpointEditor
          routeId={route.id}
          epKind={activeEP}
          ep={activeEP === "start" ? route.startMarker : route.finishMarker}
          routeColor={route.color}
          palette={palette}
          customMarkerIcons={customMarkerIcons}
          onUpdateEP={onUpdateEP}
        />
      )}

      {isOpen && !editingEP && (
        <div className="route-card__body">
          <label className="toggle-field">
            <span>Show endpoints</span>
            <span className="theme-switch">
              <input type="checkbox" checked={route.showEndpoints} onChange={e => onUpdate(route.id, { showEndpoints: e.target.checked })} />
              <span className="theme-switch-track" aria-hidden="true" />
            </span>
          </label>

          {route.showEndpoints && (
            <div className="route-card__endpoint-rows">
              {(["start", "finish"] as const).map(kind => {
                const ep = kind === "start" ? route.startMarker : route.finishMarker;
                const icon = findMarkerIcon(ep.iconId, customMarkerIcons);
                return (
                  <button key={kind} type="button" className="route-card__endpoint-row" onClick={() => setActiveEP(kind)}>
                    <span className="route-card__endpoint-row-icon">{icon && <MarkerVisual icon={icon} size={24} color={ep.color} />}</span>
                    <span className="route-card__endpoint-row-label">{kind === "start" ? "Start" : "Finish"}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="route-card__field">
            <label>
              <span>Color</span>
              <button type="button" className="route-card__color-toggle" style={{ backgroundColor: route.color }} onClick={() => setIsColorOpen(p => !p)}>
                {isColorOpen && <CloseIcon />}
              </button>
            </label>
            {isColorOpen && (
              <ColorPicker
                currentColor={route.color}
                suggestedColors={colorChoices.suggestedColors}
                moreColors={colorChoices.moreColors}
                onChange={c => onUpdate(route.id, { color: c })}
                onResetColor={() => onUpdate(route.id, { color: routeDefaultColor })}
              />
            )}
          </div>

          <div className="route-card__field">
            <label htmlFor={`rw-${route.id}`}><span>Width</span><span className="route-card__value">{route.strokeWidth}px</span></label>
            <input id={`rw-${route.id}`} type="range" min={MIN_ROUTE_STROKE_WIDTH} max={MAX_ROUTE_STROKE_WIDTH} step={1} value={route.strokeWidth} onChange={e => onUpdate(route.id, { strokeWidth: Number(e.target.value) })} />
          </div>

          <div className="route-card__field">
            <label htmlFor={`ro-${route.id}`}><span>Opacity</span><span className="route-card__value">{Math.round(route.opacity * 100)}%</span></label>
            <input id={`ro-${route.id}`} type="range" min={MIN_ROUTE_OPACITY} max={MAX_ROUTE_OPACITY} step={0.05} value={route.opacity} onChange={e => onUpdate(route.id, { opacity: Number(e.target.value) })} />
          </div>

          <div className="route-card__field">
            <label><span>Style</span></label>
            <div className="route-card__style-toggle">
              {ROUTE_LINE_STYLES.map(style => (
                <button key={style} type="button" className={`route-card__style-btn${route.lineStyle === style ? " is-active" : ""}`} onClick={() => onUpdate(route.id, { lineStyle: style })}>
                  <span>{style === "solid" ? "Solid" : "Dashed"}</span>
                  <svg className="route-card__style-preview" width="28" height="8" viewBox="0 0 28 8" aria-hidden="true">
                    <line x1="1" y1="4" x2="27" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={style === "dashed" ? "4 3" : undefined} />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <div className="route-card__actions">
            <button type="button" className="marker-row__icon-btn marker-row__icon-btn--danger" onClick={() => onRemove(route.id)}>
              <TrashIcon /><span className="marker-row__icon-btn-label">Remove Route</span>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ─── RoutesSection ────────────────────────────────────────────────────────────

export default function RoutesSection() {
  const { state, dispatch, effectiveTheme } = usePosterContext();
  const { t } = useI18n();
  const { form, routes, customMarkerIcons } = state;
  const [routeA, setRouteA] = useState({ input: "", loc: null as SearchResult | null, focused: false });
  const [routeB, setRouteB] = useState({ input: "", loc: null as SearchResult | null, focused: false });

  const autoA = useLocationAutocomplete(routeA.input, routeA.focused);
  const autoB = useLocationAutocomplete(routeB.input, routeB.focused);

  const palette = useMemo(
    () => DISPLAY_PALETTE_KEYS.map(k => getThemeColorByPath(effectiveTheme, k as ThemeColorKey)).filter(Boolean) as string[],
    [effectiveTheme],
  );

  const update = useCallback(
    (routeId: string, changes: Partial<Route>) => dispatch({ type: "UPDATE_ROUTE", routeId, changes }),
    [dispatch],
  );

  const updateEP = useCallback(
    (routeId: string, kind: Kind, changes: Partial<RouteEndpointMarker>) => {
      const route = routes.find(r => r.id === routeId);
      if (!route) return;
      const current = kind === "start" ? route.startMarker : route.finishMarker;
      dispatch({
        type: "UPDATE_ROUTE",
        routeId,
        changes: kind === "start" ? { startMarker: { ...current, ...changes } } : { finishMarker: { ...current, ...changes } },
      });
    },
    [dispatch, routes],
  );

  const removeRoute = useCallback(
    (routeId: string) => dispatch({ type: "REMOVE_ROUTE", routeId }),
    [dispatch],
  );

  const applyCurrentLocation = useCallback((target: "A" | "B") => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lon } }) => {
        const loc: SearchResult = { id: `cur:${lat},${lon}`, label: t("routes.useCurrentLocation"), shortLabel: t("routes.useCurrentLocation"), city: "", country: "", continent: "", lat, lon };
        if (target === "A") setRouteA(p => ({ ...p, input: loc.label, loc }));
        else setRouteB(p => ({ ...p, input: loc.label, loc }));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [t]);

  const createRoute = useCallback(async (a: SearchResult, b: SearchResult) => {
    const id = `route-${Date.now()}`;
    const route: Route = {
      id, label: `${a.city || a.label} → ${b.city || b.label}`,
      color: state.routeDefaults.color || "#3b82f6", opacity: state.routeDefaults.opacity ?? 0.8,
      strokeWidth: state.routeDefaults.strokeWidth ?? 4, lineStyle: "solid",
      source: "named", visible: true, showEndpoints: true,
      segments: [[{ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }]],
      waypoints: [], startMarker: { iconId: "circle", color: "#22c55e", size: 28 }, finishMarker: { iconId: "circle", color: "#ef4444", size: 28 },
    };
    dispatch({ type: "ADD_ROUTE", route });
    if (form.snapToRoads) {
      const coords = await fetchOsrmRoute([[a.lat, a.lon], [b.lat, b.lon]]);
      if (coords?.length > 1) dispatch({ type: "UPDATE_ROUTE", routeId: id, changes: { segments: [coords] } });
    }
    setRouteA({ input: "", loc: null, focused: false });
    setRouteB({ input: "", loc: null, focused: false });
    const bounds = routeBounds(route);
    if (bounds) {
      const center = boundsCenter(bounds);
      const distance = Math.round(boundsHalfWidthMeters(bounds));
      dispatch({ type: "SET_FORM_FIELDS", fields: { latitude: String(center.lat), longitude: String(center.lon), distance: String(distance) } });
    }
  }, [dispatch, form.snapToRoads, state.routeDefaults]);

  return (
    <section className="panel-block routes-settings-screen">
      <div className="markers-section-head">
        <p className="section-summary-label">ROUTES</p>
        <div className="markers-section-head-actions">
          <button type="button" className="marker-row__icon-btn marker-header-action-btn" onClick={() => dispatch({ type: "SET_FIELD", name: "showRoutes", value: !form.showRoutes })} disabled={!routes.length}>
            <span className="marker-row__icon-btn-label">{form.showRoutes ? "Hide All" : "Show All"}</span>
          </button>
          <button
            type="button"
            className={`marker-row__icon-btn marker-header-action-btn${state.routeDrawMode ? " is-active" : ""}`}
            onClick={() => {
              if (state.routeDrawMode) {
                dispatch({ type: "SET_ROUTE_DRAW_MODE", active: false });
              } else {
                dispatch({ type: "SET_ROUTE_DRAW_MODE", active: true });
                dispatch({ type: "SET_ROUTE_EDIT_MODE", active: false });
              }
            }}
          >
            <span className="marker-row__icon-btn-label">{state.routeDrawMode ? "Cancel" : "Draw Route"}</span>
          </button>
        </div>
      </div>

      <div className="ios-toggle-row" style={{ marginBottom: 8 }}>
        <span className="ios-toggle-label">Snap to roads</span>
        <label className="ios-toggle">
          <input type="checkbox" checked={Boolean(form.snapToRoads)} onChange={() => dispatch({ type: "SET_FIELD", name: "snapToRoads", value: !form.snapToRoads })} />
          <span className="ios-track" />
        </label>
      </div>

      {state.routeDrawMode && (
        <div className="route-draw-mode-active">
          <span className="route-draw-mode-active__dot" />
          Click <strong>start point</strong> on the map, then click <strong>finish point</strong>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        <LocationInput
          label={t("routes.locationA")}
          value={routeA.input}
          focused={routeA.focused}
          suggestions={autoA.locationSuggestions}
          searching={autoA.isLocationSearching}
          onChange={e => setRouteA(p => ({ ...p, input: e.target.value, loc: null }))}
          onFocus={() => setRouteA(p => ({ ...p, focused: true }))}
          onBlur={() => setRouteA(p => ({ ...p, focused: false }))}
          onSelect={s => { setRouteA({ input: s.label, loc: s, focused: false }); autoA.clearLocationSuggestions(); }}
          onUseCurrentLocation={() => applyCurrentLocation("A")}
        />
        <LocationInput
          label={t("routes.locationB")}
          value={routeB.input}
          focused={routeB.focused}
          suggestions={autoB.locationSuggestions}
          searching={autoB.isLocationSearching}
          onChange={e => setRouteB(p => ({ ...p, input: e.target.value, loc: null }))}
          onFocus={() => setRouteB(p => ({ ...p, focused: true }))}
          onBlur={() => setRouteB(p => ({ ...p, focused: false }))}
          onSelect={s => { setRouteB({ input: s.label, loc: s, focused: false }); autoB.clearLocationSuggestions(); }}
          onUseCurrentLocation={() => applyCurrentLocation("B")}
        />
        <button
          type="button"
          className="route-card__style-btn is-active"
          disabled={!routeA.loc || !routeB.loc}
          onClick={() => { if (routeA.loc && routeB.loc) void createRoute(routeA.loc, routeB.loc); }}
          style={{ width: "100%", justifyContent: "center", opacity: !routeA.loc || !routeB.loc ? 0.5 : 1 }}
        >
          {t("routes.createRoute")}
        </button>
      </div>

      <div className="routes-section__content">
        {!routes.length && (
          <p className="routes-section__empty">Press <strong>Draw Route</strong> above, then click two points on the map.</p>
        )}
        {routes.map(route => (
          <RouteCard
            key={route.id}
            route={route}
            palette={palette}
            customMarkerIcons={customMarkerIcons}
            routeDefaultColor={state.routeDefaults.color}
            onUpdate={update}
            onUpdateEP={updateEP}
            onRemove={removeRoute}
          />
        ))}
      </div>
    </section>
  );
}
