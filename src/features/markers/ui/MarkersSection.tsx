import { useCallback, useEffect, useMemo, useState } from "react";
import { useMobileViewport } from "@/shared/hooks/useMobileViewport";
import { useI18n } from "@/shared/i18n/context";
import { createPortal } from "react-dom";
import { usePosterContext } from "@/features/poster/ui/PosterContext";
import type { MarkerDefaults, MarkerItem } from "@/features/markers/domain/types";
import type { SearchResult } from "@/features/location/domain/types";
import { useLocationAutocomplete } from "@/features/location/application/useLocationAutocomplete";
import MarkerPicker from "./MarkerPicker";
import { createMarkerItem, createUploadedMarkerIcon, getUploadLabel } from "@/features/markers/infrastructure/helpers";
import { findMarkerIcon } from "@/features/markers/infrastructure/iconRegistry";
import { DEFAULT_MARKER_SIZE, MAX_MARKER_SIZE, MIN_MARKER_SIZE } from "@/features/markers/domain/constants";
import { RADIUS_OPTIONS } from "@/core/config";
import MarkerVisual from "./MarkerVisual";
import { CheckIcon, CloseIcon, EditIcon, GearIcon, InfoIcon, PlusIcon, RotateLeftIcon, SearchIcon, TrashIcon } from "@/shared/ui/Icons";
import { LogoUploadField as _LogoUploadField } from "@/features/poster/ui/LogoUploadField";
import ColorPicker from "@/features/theme/ui/ColorPicker";
import { buildDynamicColorChoices } from "@/features/theme/domain/colorSuggestions";
import { DISPLAY_PALETTE_KEYS, type ThemeColorKey } from "@/features/theme/domain/types";
import { getThemeColorByPath } from "@/features/theme/domain/colorPaths";
import { normalizeHexColor } from "@/shared/utils/color";

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result ?? ""));
  r.onerror = () => reject(new Error("Could not read marker upload."));
  r.readAsDataURL(file);
});
const isSvgFile = (f: File) => f.type === "image/svg+xml" || f.name.toLowerCase().endsWith(".svg");
const fmtCoord = (v: number) => Number(v).toFixed(6);

function DeleteAllModal({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n();
  return createPortal(
    <div className="picker-modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="picker-modal marker-delete-confirm-modal" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="marker-delete-modal__body">
          <p className="marker-delete-modal__headline">{t("markers.deleteAll") as string}</p>
          <p className="marker-delete-modal__text">{(t("markers.willRemove") as string).replace("{n}", String(count))}</p>
          <div className="marker-delete-modal__actions">
            <button type="button" className="marker-delete-modal__cancel" onClick={onCancel}>{t("markers.keepMarkers") as string}</button>
            <button type="button" className="marker-delete-modal__confirm" onClick={onConfirm}><TrashIcon />{t("markers.deleteMarkers") as string}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SliderWithInput({ label, value, min, max, step = "1", onChange }: { label: string; value: number; min: number; max: number; step?: string; onChange: (v: number) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
  };
  return (
    <label>{label}
      <div className="marker-editor-card__size-row">
        <input className="marker-editor-card__size-slider" type="range" min={min} max={max} step={step} value={value} onChange={handleChange} />
        <input className="form-control-tall marker-editor-card__size-input" type="number" min={min} max={max} step={step} value={value} onChange={handleChange} />
      </div>
    </label>
  );
}

function ColorButton({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <div className="marker-color-control">
      <button type="button" className="marker-color-display-btn" onClick={onClick}>
        <span className="marker-editor-card__color-swatch" aria-hidden="true" style={{ backgroundColor: normalizeHexColor(color) || "#000000" }} />
        <span className="marker-editor-card__color-value">{color}</span>
      </button>
    </div>
  );
}

function MarkerCard({ marker, icon, markerLabel, onEdit, onRemove }: { marker: MarkerItem; icon: any; markerLabel: string; onEdit: () => void; onRemove: () => void }) {
  return (
    <article className="marker-mobile-card" role="listitem">
      <button type="button" className="marker-mobile-card__delete" onClick={e => { e.stopPropagation(); onRemove(); }} aria-label={`Delete ${markerLabel}`}><CloseIcon /></button>
      <button type="button" className="marker-mobile-card__select" onClick={onEdit}>
        {icon && <MarkerVisual icon={icon} size={24} color={marker.color} />}
        <span className="marker-mobile-card__label">{markerLabel}</span>
      </button>
    </article>
  );
}

export default function MarkersSection() {
  const { t } = useI18n();
  const { state, dispatch, mapRef, effectiveTheme } = usePosterContext();
  const { form, markers, customMarkerIcons, markerDefaults, isMarkerEditorActive, activeMarkerId } = state;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDefaultColorPickerOpen, setIsDefaultColorPickerOpen] = useState(false);
  const [openColorPickerId, setOpenColorPickerId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const isMobile = useMobileViewport();
  const [isCustomTextOpen, setIsCustomTextOpen] = useState(false);
  const [customTextSearch, setCustomTextSearch] = useState("");
  const [customTextLabel, setCustomTextLabel] = useState("");
  const [customTextFocused, setCustomTextFocused] = useState(false);
  const [selectedCustomLoc, setSelectedCustomLoc] = useState<SearchResult | null>(null);
  const markerThemeColor = effectiveTheme.ui.text;
  const hasMarkers = markers.length > 0;

  const { locationSuggestions: ctSuggestions, isLocationSearching: ctSearching, clearLocationSuggestions: clearCtSuggestions, searchNow: searchCt } = useLocationAutocomplete(customTextSearch, customTextFocused);

  useEffect(() => {
    if (!isMarkerEditorActive) { setExpandedId(null); setOpenColorPickerId(null); setIsDefaultColorPickerOpen(false); return; }
    if (!activeMarkerId) return;
    if (markers.some(m => m.id === activeMarkerId)) setExpandedId(activeMarkerId);
    else { setExpandedId(null); setOpenColorPickerId(null); }
  }, [isMarkerEditorActive, activeMarkerId, markers]);

  const toggleCustomText = useCallback(() => {
    setIsCustomTextOpen(p => {
      if (p) { setCustomTextSearch(""); setCustomTextLabel(""); setSelectedCustomLoc(null); clearCtSuggestions(); }
      return !p;
    });
  }, [clearCtSuggestions]);

  const update = useCallback((id: string, changes: Partial<MarkerItem>) => dispatch({ type: "UPDATE_MARKER", markerId: id, changes }), [dispatch]);
  const remove = useCallback((id: string) => {
    dispatch({ type: "REMOVE_MARKER", markerId: id });
    if (activeMarkerId === id) { dispatch({ type: "SET_ACTIVE_MARKER", markerId: null }); setExpandedId(null); setOpenColorPickerId(null); }
  }, [activeMarkerId, dispatch]);

  const applyDefaults = useCallback((d: Partial<MarkerDefaults>) => dispatch({ type: "SET_MARKER_DEFAULTS", defaults: d, applyToMarkers: true }), [dispatch]);

  const addMarker = useCallback((iconId: string) => {
    const c = mapRef.current?.getCenter();
    dispatch({ type: "ADD_MARKER", marker: createMarkerItem({ lat: (c?.lat ?? Number(form.latitude)) || 0, lon: (c?.lng ?? Number(form.longitude)) || 0, iconId, defaults: markerDefaults }) });
  }, [dispatch, form.latitude, form.longitude, mapRef, markerDefaults]);

  const handleUploadIcon = useCallback(async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    const icon = createUploadedMarkerIcon({ label: getUploadLabel(file.name), dataUrl, tintWithMarkerColor: isSvgFile(file) });
    dispatch({ type: "ADD_CUSTOM_MARKER_ICON", icon }); addMarker(icon.id);
  }, [addMarker, dispatch]);

  const openEditor = useCallback((id: string) => { setExpandedId(id); setOpenColorPickerId(null); dispatch({ type: "SET_ACTIVE_MARKER", markerId: id }); }, [dispatch]);
  const toggleEditor = useCallback((id: string) => {
    setExpandedId(p => { const next = p === id ? null : id; dispatch({ type: "SET_ACTIVE_MARKER", markerId: next }); return next; });
    setOpenColorPickerId(p => p === id ? null : p);
  }, [dispatch]);

  const toggleEditMode = useCallback(() => {
    const next = !isMarkerEditorActive;
    if (next) { setIsSettingsOpen(false); setIsDefaultColorPickerOpen(false); }
    dispatch({ type: "SET_MARKER_EDITOR_ACTIVE", active: next });
    if (!next) { dispatch({ type: "SET_ACTIVE_MARKER", markerId: null }); setExpandedId(null); setOpenColorPickerId(null); }
  }, [dispatch, isMarkerEditorActive]);

  const handleAddCustomText = useCallback(() => {
    if (!selectedCustomLoc) return;
    dispatch({ type: "ADD_MARKER", marker: createMarkerItem({ lat: selectedCustomLoc.lat, lon: selectedCustomLoc.lon, defaults: markerDefaults, label: customTextLabel.trim() || undefined }) });
    setCustomTextSearch(""); setCustomTextLabel(""); setSelectedCustomLoc(null); clearCtSuggestions();
  }, [selectedCustomLoc, customTextLabel, markerDefaults, dispatch, clearCtSuggestions]);

  const markerRows = useMemo(() => {
    const counts = new Map<string, number>();
    return markers.map((marker, index) => {
      const icon = findMarkerIcon(marker.iconId, customMarkerIcons);
      const lbl = String(icon?.label ?? "Marker").trim() || "Marker";
      counts.set(lbl, (counts.get(lbl) ?? 0) + 1);
      return { marker, index, icon, markerLabel: `${lbl} ${counts.get(lbl)}`, isExpanded: expandedId === marker.id };
    });
  }, [customMarkerIcons, expandedId, markers]);

  const palette = useMemo(() => DISPLAY_PALETTE_KEYS.map(k => getThemeColorByPath(effectiveTheme, k as ThemeColorKey)).filter(Boolean), [effectiveTheme]);
  const defaultColorChoices = useMemo(() => buildDynamicColorChoices(markerDefaults.color, palette), [markerDefaults.color, palette]);

  const isColorFocused = isMarkerEditorActive && expandedId !== null && openColorPickerId === expandedId;
  const activeColorRow = isColorFocused ? (markerRows.find(r => r.marker.id === expandedId) ?? null) : null;
  const activeColorChoices = activeColorRow ? buildDynamicColorChoices(activeColorRow.marker.color, palette) : null;
  const visibleRows = isMarkerEditorActive && expandedId ? markerRows.filter(r => r.marker.id === expandedId) : markerRows;

  return (
    <section className="panel-block color-editor-screen marker-settings-screen">
      {deleteModalOpen && <DeleteAllModal count={markers.length} onCancel={() => setDeleteModalOpen(false)} onConfirm={() => { dispatch({ type: "CLEAR_MARKERS" }); setExpandedId(null); setOpenColorPickerId(null); setDeleteModalOpen(false); }} />}

      <div className="markers-section-head">
        <p className="section-summary-label">{t("info.markers") as string}</p>
        <div className="markers-section-head-actions">
          {!isMarkerEditorActive && (
            <button type="button" className={`marker-row__icon-btn marker-header-action-btn marker-header-settings-btn${isSettingsOpen ? " is-active" : " is-compact"}`} onClick={() => setIsSettingsOpen(p => { if (p) setIsDefaultColorPickerOpen(false); return !p; })} aria-label={isSettingsOpen ? t("markers.doneSettings") as string : t("markers.openSettings") as string}>
              <span className="marker-row__icon-btn-icon" aria-hidden="true">{isSettingsOpen ? <CheckIcon /> : <GearIcon />}</span>
              {isSettingsOpen && <span className="marker-row__icon-btn-label">{t("markers.done") as string}</span>}
            </button>
          )}
          {(isMarkerEditorActive || !isSettingsOpen) && (
            <button type="button" className={`marker-row__icon-btn marker-header-action-btn${isMarkerEditorActive ? " is-active" : ""}`} onClick={toggleEditMode} disabled={!isMarkerEditorActive && !hasMarkers}>
              <span className="marker-row__icon-btn-icon" aria-hidden="true">{isMarkerEditorActive ? <CheckIcon /> : <EditIcon />}</span>
              <span className="marker-row__icon-btn-label">{isMarkerEditorActive ? t("markers.done") as string : t("markers.editMarker") as string}</span>
            </button>
          )}
          {!isMarkerEditorActive && !isSettingsOpen && (
            <button type="button" className={`marker-row__icon-btn marker-header-action-btn${isCustomTextOpen ? " is-active" : ""}`} onClick={toggleCustomText}>
              <span className="marker-row__icon-btn-icon" aria-hidden="true">{isCustomTextOpen ? <CloseIcon /> : <PlusIcon />}</span>
              <span className="marker-row__icon-btn-label">{isCustomTextOpen ? t("close") as string : t("markers.addCustomTextMarker") as string}</span>
            </button>
          )}
          <div className="marker-info-wrap marker-info-wrap--top">
            <button type="button" className="icon-only-btn marker-info-btn" aria-label="Marker picker help"><InfoIcon /></button>
            <div className="marker-info-popover" role="tooltip">{isMobile ? "Click an icon to drop a marker on the current map location. In marker edit mode, drag to move markers and use the marker size slider below the location row to resize." : "Click an icon to drop a marker on the current map location. In marker edit mode, drag to move, use the arrow keys for fine nudging, use two-finger pinch or mouse wheel to resize."}</div>
          </div>
        </div>
      </div>

      <div className="markers-section__content">
        {!isMarkerEditorActive && !isSettingsOpen && (
          <MarkerPicker markerColor={markerDefaults.color} customIcons={customMarkerIcons} onIconClick={addMarker} onUploadIcon={handleUploadIcon} onRemoveUploadedIcon={iconId => dispatch({ type: "REMOVE_CUSTOM_MARKER_ICON", iconId })} onClearUploadedIcons={() => dispatch({ type: "CLEAR_CUSTOM_MARKER_ICONS" })} />
        )}

        {!isMarkerEditorActive && isCustomTextOpen && (
          <div className="marker-settings-card" style={{ marginTop: 12 }}>
            <div className="marker-settings-card__header"><h3>{t("markers.customTextMarker") as string}</h3></div>
            <div className="marker-editor-card__stack" style={{ gap: 12 }}>
              <div className="location-autocomplete" style={{ position: "relative" }}>
                <div className="location-search-row">
                  <div className="location-input-wrap" style={{ flex: 1 }}>
                    <input className="form-control-tall" value={customTextSearch} onChange={e => { setCustomTextSearch(e.target.value); setSelectedCustomLoc(null); }} onFocus={() => setCustomTextFocused(true)} onBlur={() => setCustomTextFocused(false)} onKeyDown={e => { if (e.key === "Enter") void searchCt(e.currentTarget.value); }} placeholder={t("markers.searchLocation") as string} autoComplete="off" />
                    {customTextSearch && <button type="button" className="location-clear-btn" aria-label="Clear" onMouseDown={e => e.preventDefault()} onClick={() => { setCustomTextSearch(""); setSelectedCustomLoc(null); clearCtSuggestions(); }}>x</button>}
                  </div>
                  <button type="button" className="location-current-btn" onMouseDown={e => e.preventDefault()} onClick={() => searchCt(customTextSearch)}><SearchIcon /></button>
                </div>
                {customTextFocused && ctSuggestions.length > 0 && (
                  <ul className="location-suggestions" role="listbox" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20 }}>
                    {ctSuggestions.map(s => <li key={s.id}><button type="button" className="location-suggestion" onMouseDown={e => { e.preventDefault(); setSelectedCustomLoc(s); setCustomTextSearch(s.label); clearCtSuggestions(); }}>{s.label}</button></li>)}
                  </ul>
                )}
                {ctSearching && <p className="location-suggestions-loading">Searching...</p>}
              </div>
              <label>{t("markers.markerLabel") as string}<input className="form-control-tall" value={customTextLabel} onChange={e => setCustomTextLabel(e.target.value)} autoComplete="off" /></label>
              <button type="button" className="general-header-text-btn" onClick={handleAddCustomText} disabled={!selectedCustomLoc}><PlusIcon />{t("markers.addMarker") as string}</button>
            </div>
          </div>
        )}

        {!isMarkerEditorActive && isSettingsOpen && (
          <div className="marker-settings-card">
            <div className="marker-settings-card__header">
              <h3>{t("markers.settings") as string}</h3>
              <p className="marker-settings-card__theme-desc">{t("markers.settingsApply") as string}</p>
            </div>
            <div className="marker-editor-card__stack">
              <SliderWithInput label={t("markers.defaultSize") as string} value={markerDefaults.size} min={MIN_MARKER_SIZE} max={MAX_MARKER_SIZE} onChange={v => applyDefaults({ size: v })} />
              <div className="marker-settings-card__theme-color">
                <span className="marker-settings-card__theme-label">{t("markers.defaultColor") as string}</span>
                <ColorButton color={markerDefaults.color} onClick={() => setIsDefaultColorPickerOpen(p => !p)} />
              </div>
            </div>
            {isDefaultColorPickerOpen && <ColorPicker currentColor={markerDefaults.color} suggestedColors={defaultColorChoices.suggestedColors} moreColors={defaultColorChoices.moreColors} onChange={c => applyDefaults({ color: c })} onResetColor={() => applyDefaults({ color: markerThemeColor })} />}
          </div>
        )}

        {isMarkerEditorActive && (
          <>
            {isColorFocused && activeColorRow ? (
              <article className="marker-editor-card">
                <div className="marker-settings-card__header">
                  <h3>{t("markers.editColor") as string}</h3>
                  <button type="button" className="marker-row__icon-btn" onClick={() => setOpenColorPickerId(null)}><span className="marker-row__icon-btn-label">Done</span></button>
                </div>
                <ColorPicker currentColor={activeColorRow.marker.color} suggestedColors={activeColorChoices!.suggestedColors} moreColors={activeColorChoices!.moreColors} onChange={c => update(activeColorRow.marker.id, { color: c })} onResetColor={() => update(activeColorRow.marker.id, { color: markerDefaults.color })} />
              </article>
            ) : (
              <>
                {visibleRows.length > 0 ? (
                  <>
                    {!expandedId ? (
                      <div className={isMobile ? "markers-section__mobile-strip" : "markers-section__marker-grid"} role="list">
                        {markerRows.map(({ marker, icon, markerLabel }) => (
                          <MarkerCard key={marker.id} marker={marker} icon={icon} markerLabel={markerLabel} onEdit={() => openEditor(marker.id)} onRemove={() => remove(marker.id)} />
                        ))}
                      </div>
                    ) : (
                      <div className="markers-section__list">
                        {visibleRows.map(({ marker, icon, markerLabel, isExpanded }) => (
                          <article key={marker.id} className="marker-editor-card">
                            <div className="marker-row">
                              <div className="marker-row__summary">{icon && <MarkerVisual icon={icon} size={26} color={marker.color} />}<span className="marker-row__title">{markerLabel}</span></div>
                              <div className="marker-row__actions">
                                <button type="button" className="marker-row__icon-btn" onClick={() => toggleEditor(marker.id)}>
                                  <span className="marker-row__icon-btn-icon">{isExpanded ? <CheckIcon /> : <EditIcon />}</span>
                                  <span className="marker-row__icon-btn-label">{isExpanded ? "Done" : "Edit"}</span>
                                </button>
                                <button type="button" className="marker-row__icon-btn marker-row__icon-btn--danger" onClick={() => remove(marker.id)}><TrashIcon /></button>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="marker-editor-card__details">
                                <div className="field-grid keep-two-mobile">
                                  <label>Latitude<input className="form-control-tall" type="number" step="0.000001" min={-90} max={90} value={fmtCoord(marker.lat)} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) update(marker.id, { lat: Math.max(-90, Math.min(90, v)) }); }} /></label>
                                  <label>Longitude<input className="form-control-tall" type="number" step="0.000001" min={-180} max={180} value={fmtCoord(marker.lon)} onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) update(marker.id, { lon: Math.max(-180, Math.min(180, v)) }); }} /></label>
                                </div>
                                <div className="marker-editor-card__stack">
                                  <label>Label<input className="form-control-tall" value={marker.label ?? ""} onChange={e => update(marker.id, { label: e.target.value || undefined })} placeholder="Optional label text" /></label>
                                </div>
                                <div className="marker-editor-card__stack">
                                  <SliderWithInput label="Size" value={marker.size} min={MIN_MARKER_SIZE} max={MAX_MARKER_SIZE} onChange={v => update(marker.id, { size: v })} />
                                  <div>
                                    <span className="marker-settings-card__theme-label">Color</span>
                                    <ColorButton color={marker.color} onClick={() => setOpenColorPickerId(p => p === marker.id ? null : marker.id)} />
                                  </div>
                                </div>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="marker-settings-card__theme-note">{t("markers.addMarkerNote") as string}</p>
                )}

                {!expandedId && hasMarkers && (
                  <>
                    <p className="marker-settings-toggle-hint marker-settings-toggle-hint--editor">{isMobile ? "Swipe the marker row to choose one, then tap it to edit. Drag it on the map to move it, and use the marker-size slider below the location row to resize." : "Click a marker card to edit it. Drag the selected marker on the map to move it, use the arrow keys for fine nudging, then adjust size and color in the editor."}</p>
                    <div className="markers-section__actions">
                      <button type="button" className="marker-row__icon-btn" onClick={() => dispatch({ type: "SET_MARKER_DEFAULTS", defaults: { size: DEFAULT_MARKER_SIZE, color: markerThemeColor }, applyToMarkers: true })}><RotateLeftIcon /><span className="marker-row__icon-btn-label">{t("markers.resetMarkers") as string}</span></button>
                      <button type="button" className="marker-row__icon-btn marker-row__icon-btn--danger" onClick={() => hasMarkers && setDeleteModalOpen(true)}><TrashIcon /><span className="marker-row__icon-btn-label">{t("markers.deleteAllMarkers") as string}</span></button>
                    </div>
                  </>
                )}

                {!isMarkerEditorActive && (
                  <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
                    <div className="panel-block" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
                      <p className="section-summary-label">Logo</p><_LogoUploadField form={form} />
                    </div>
                    <div className="panel-block" style={{ padding: 0, background: "transparent", border: "none", boxShadow: "none" }}>
                      <p className="section-summary-label">Radius Highlight</p>
                      <label className="toggle-field"><span>Walking / driving radius</span>
                        <span className="theme-select-wrapper">
                          <select className="theme-select" name="radiusMeters" value={form.radiusMeters} onChange={e => dispatch({ type: "SET_FIELD", name: "radiusMeters", value: e.target.value })}>
                            {RADIUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// LogoUploadField has moved to its own file — re-exported here for backward compatibility.
export { LogoUploadField } from "@/features/poster/ui/LogoUploadField";
