import { useState } from "react";
import { usePosterContext } from "@/features/poster/ui/PosterContext";
import { useFormHandlers } from "@/features/poster/application/useFormHandlers";
import { useLocationAutocomplete } from "@/features/location/application/useLocationAutocomplete";
import { useCurrentLocation } from "@/features/location/application/useCurrentLocation";
import { useMapSync } from "@/features/map/application/useMapSync";
import type { MobileTab } from "@/shared/ui/MobileNavBar";
import { useI18n } from "@/shared/i18n/context";
import LocationSection from "@/features/location/ui/LocationSection";
import AppSettingsSection from "./AppSettingsSection";
import MapSettingsSection from "@/features/map/ui/MapSettingsSection";
import LayersSection from "@/features/map/ui/LayersSection";
import MarkersSection from "@/features/markers/ui/MarkersSection";
import RoutesSection from "@/features/routes/ui/RoutesSection";
import TypographySection from "@/features/poster/ui/TypographySection";
import DualCitySection from "@/features/poster/ui/DualCitySection";
import {
  LocationIcon, ThemeIcon, LayoutIcon, LayersIcon, MarkersIcon, RouteIcon, StyleIcon,
  ChevronDownIcon, GearIcon,
} from "@/shared/ui/Icons";
import { themeOptions } from "@/features/theme/infrastructure/themeRepository";
import { layoutGroups } from "@/features/layout/infrastructure/layoutRepository";
import { MIN_POSTER_CM, MAX_POSTER_CM, FONT_OPTIONS } from "@/core/config";
import type { SearchResult } from "@/features/location/domain/types";

type SectionId = "app" | "location" | "theme" | "layout" | "dualCity" | "style" | "layers" | "markers" | "routes";

const SECTIONS: { id: SectionId; labelKey: string; step: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "app", labelKey: "nav.settings", step: "00", Icon: GearIcon },
  { id: "location", labelKey: "location", step: "01", Icon: LocationIcon },
  { id: "theme", labelKey: "theme", step: "02", Icon: ThemeIcon },
  { id: "layout", labelKey: "layout.posterSize", step: "03", Icon: LayoutIcon },
  { id: "dualCity", labelKey: "nav.dualCity", step: "04", Icon: LocationIcon },
  { id: "style", labelKey: "text.typography", step: "05", Icon: StyleIcon },
  { id: "layers", labelKey: "layers", step: "06", Icon: LayersIcon },
  { id: "markers", labelKey: "info.markers", step: "07", Icon: MarkersIcon },
  { id: "routes", labelKey: "showRoutes", step: "08", Icon: RouteIcon },
];

export default function SettingsPanel({ mobileTab, desktopActivePanel }: { mobileTab?: MobileTab; desktopActivePanel?: string }) {
  const { state, dispatch, mapRef, selectedTheme } = usePosterContext();
  const { t } = useI18n();
  const handlers = useFormHandlers();
  const { locationSuggestions, isLocationSearching, searchNow } = useLocationAutocomplete(state.form.location, state.isLocationFocused);
  const { flyToLocation } = useMapSync(state, dispatch, mapRef);
  const { handleUseCurrentLocation, isLocatingUser, locationPermissionMessage } = useCurrentLocation(flyToLocation);
  const [isColorEditorActive, setIsColorEditorActive] = useState(false);
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(["location", "theme", "layout", "dualCity", "style"]));

  const showSuggestions = state.isLocationFocused && locationSuggestions.length > 0;
  const toggle = (id: SectionId) => setOpenSections(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const onLocationSelect = (loc: SearchResult) => { handlers.handleLocationSelect(loc); flyToLocation(loc.lat, loc.lon); };

  const renderSection = (id: SectionId) => {
    const c = { form: state.form, onChange: handlers.handleChange };
    if (isColorEditorActive && ["location", "theme", "layout", "markers", "routes", "dualCity"].includes(id)) return null;
    if (id === "app") return <AppSettingsSection form={state.form} onChange={handlers.handleChange} />;
    if (id === "location") return (
      <LocationSection {...c}
        onLocationFocus={() => handlers.setLocationFocused(true)}
        onLocationBlur={() => handlers.setLocationFocused(false)}
        searchNow={searchNow}
        showLocationSuggestions={showSuggestions}
        locationSuggestions={locationSuggestions}
        isLocationSearching={isLocationSearching}
        onLocationSelect={onLocationSelect}
        onClearLocation={handlers.handleClearLocation}
        onUseCurrentLocation={handleUseCurrentLocation}
        isLocatingUser={isLocatingUser}
        locationPermissionMessage={locationPermissionMessage}
      />
    );
    if (id === "theme" || id === "layout") return (
      <MapSettingsSection
        activeMobileTab={desktopActivePanel || id}
        form={state.form} onChange={handlers.handleChange}
        onNumericFieldBlur={handlers.handleNumericFieldBlur}
        onThemeChange={handlers.handleThemeChange}
        onLayoutChange={handlers.handleLayoutChange}
        selectedTheme={selectedTheme}
        themeOptions={themeOptions} layoutGroups={layoutGroups}
        minPosterCm={MIN_POSTER_CM} maxPosterCm={MAX_POSTER_CM}
        customColors={state.customColors}
        onColorChange={handlers.handleColorChange}
        onResetColors={handlers.handleResetColors}
        onColorEditorActiveChange={setIsColorEditorActive}
      />
    );
    if (id === "layers") return <LayersSection form={state.form} onChange={handlers.handleChange} minPosterCm={MIN_POSTER_CM} maxPosterCm={MAX_POSTER_CM} onNumericFieldBlur={handlers.handleNumericFieldBlur} />;
    if (id === "markers") return <MarkersSection />;
    if (id === "routes") return <RoutesSection />;
    if (id === "dualCity") return <DualCitySection form={state.form} onChange={handlers.handleChange} onTheme2Change={handlers.handleTheme2Change} />;
    if (id === "style") return <TypographySection form={state.form} onChange={handlers.handleChange} fontOptions={FONT_OPTIONS} />;
    return null;
  };

  if (desktopActivePanel) {
    const section = SECTIONS.find(s => s.id === desktopActivePanel);
    if (!section) return null;
    return (
      <form className="settings-panel settings-panel--desktop" onSubmit={e => e.preventDefault()}>
        <div className="panel-view" data-panel={desktopActivePanel}>
          <div className="panel-hdr"><h2>{t(section.labelKey as any)}</h2></div>
          <div className="section">{renderSection(section.id)}</div>
        </div>
      </form>
    );
  }

  const visibleSections = mobileTab ? SECTIONS.filter(s => s.id !== "app") : SECTIONS;
  return (
    <form className="settings-panel" onSubmit={e => e.preventDefault()}>
      {visibleSections.map(s => (
        <div key={s.id} className={`mobile-section mobile-section--${s.id} accordion-item${openSections.has(s.id) ? " accordion-item--open" : ""}`}>
          <button type="button" className={`accordion-header${openSections.has(s.id) ? " is-open" : ""}`} onClick={() => toggle(s.id)} aria-expanded={openSections.has(s.id)}>
            <span className="accordion-step-badge">{s.step}</span>
            <s.Icon className="accordion-icon" />
            <span className="accordion-label">{t(s.labelKey as any)}</span>
            <ChevronDownIcon className="accordion-chevron" />
          </button>
          <div className={`accordion-body${openSections.has(s.id) ? " is-open" : ""}`}>
            <div className="accordion-body-inner">{renderSection(s.id)}</div>
          </div>
        </div>
      ))}
      {!isColorEditorActive && state.error && <p className="error">{state.error}</p>}
      <div className="settings-credits">
        <p className="settings-credits-text">
          <strong>MapToPoster</strong> &mdash; Inspired by{" "}
          <a href="https://github.com/originalankur/maptoposter" target="_blank" rel="noopener noreferrer">originalankur/maptoposter</a>.
          This project is an independent implementation built with a different stack and architecture.
        </p>
      </div>
    </form>
  );
}
