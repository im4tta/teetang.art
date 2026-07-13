import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { useSearchParams } from "react-router-dom";
import { usePosterContext } from "@/context/PosterContext";
import { useI18n } from "@/context/i18n/context";
import { geocodeLocation } from "@/services/container";
import { MAX_MARKER_SIZE, MIN_MARKER_SIZE } from "@/services/markers/constants";
import GeneralHeader from "@/components/layout/GeneralHeader";
import DesktopTopBar from "@/components/layout/DesktopTopBar";
import FooterNote from "@/components/layout/FooterNote";
import PreviewPanel from "@/components/ui/PreviewPanel";
import MobileNavBar, { type MobileTab } from "@/components/layout/MobileNavBar";
import InstallPrompt from "@/components/ui/InstallPrompt";
import { useSwipeDown } from "@/hooks/useSwipeDown";
import { CheckIcon } from "@/components/ui/Icons";
import SupportModal from "@/components/ui/SupportModal";
import { SUPPORT_PROMPT_EVENT, type SupportPromptState } from "@/hooks/useExport";
import DotField from "@/components/layout/DotField";
import DesktopLocationBar from "@/components/layout/DesktopLocationBar";

const AboutModal = lazy(() => import("@/components/ui/AboutModal"));
const SettingsPanel = lazy(() => import("@/components/ui/SettingsPanel"));
const AnnouncementModal = lazy(() => import("@/components/ui/AnnouncementModal"));
const UserGuidePanel = lazy(() => import("@/components/ui/UserGuidePanel"));

function SettingsDrawer({ mobileTab, onClose, showAllSections = false }: { mobileTab: MobileTab; onClose: () => void; showAllSections?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { sheetRef, handleRef, handleProps } = useSwipeDown(onClose, 80, { onExpand: () => setExpanded(true) });
  return (
    <div className="mobile-drawer" role="dialog" aria-label="Settings">
      <div className="mobile-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`mobile-drawer-sheet${expanded ? " is-expanded" : ""}`} ref={sheetRef} data-mobile-tab={showAllSections ? "settings" : mobileTab}>
        <div className="mobile-drawer-handle" ref={handleRef} aria-hidden="true" {...handleProps} />
        <div className="mobile-drawer-content">
          <SettingsPanel mobileTab={mobileTab} />
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  const { t } = useI18n();
  const { state, dispatch } = usePosterContext();
  const { isMarkerEditorActive } = state;
  const activeMarker = state.activeMarkerId != null ? (state.markers.find(m => m.id === state.activeMarkerId) ?? null) : null;

  const [mobileTab, setMobileTab] = useState<MobileTab>("theme");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileLocationVisible, setMobileLocationVisible] = useState(true);
  const isMobileViewport = useMobileViewport();
  const [desktopTab, setDesktopTab] = useState<MobileTab>("theme");
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [supportPrompt, setSupportPrompt] = useState<SupportPromptState | null>(null);

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const city = searchParams.get("city");
    const theme = searchParams.get("theme");
    let cancelled = false;
    async function apply() {
      if (theme) dispatch({ type: "SET_THEME", themeId: theme });
      if (city) {
        try {
          const r = await geocodeLocation(city);
          if (!cancelled) dispatch({ type: "SELECT_LOCATION", location: r });
        } catch {
          if (!cancelled) dispatch({ type: "SET_FORM_FIELDS", fields: { displayCity: city, displayCountry: "Cambodia" } });
        }
      }
    }
    void apply();
    return () => { cancelled = true; };
  }, [searchParams, dispatch]);

  useEffect(() => {
    const handler = (e: Event) => setSupportPrompt((e as CustomEvent<SupportPromptState>).detail);
    window.addEventListener(SUPPORT_PROMPT_EVENT, handler);
    return () => window.removeEventListener(SUPPORT_PROMPT_EVENT, handler);
  }, []);

  useEffect(() => {
    const preload = () => {
      void import("@/components/ui/SettingsPanel");
      void import("@/components/ui/ExportFab");
      void import("@/components/ui/AnnouncementModal");
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const tid = setTimeout(preload, 300);
    return () => clearTimeout(tid);
  }, []);


  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const prev = { bO: document.body.style.overflow, hO: document.documentElement.style.overflow, bS: document.body.style.overscrollBehavior, hS: document.documentElement.style.overscrollBehavior };
    document.body.style.overflow = document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prev.bO; document.documentElement.style.overflow = prev.hO;
      document.body.style.overscrollBehavior = prev.bS; document.documentElement.style.overscrollBehavior = prev.hS;
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    const theme = state.form.appTheme || "dark";
    const density = state.form.uiDensity || "comfortable";
    document.documentElement.setAttribute("data-app-theme", theme);
    document.documentElement.setAttribute("data-ui-density", density);
    document.body.classList.toggle("light-theme", theme === "light");
    document.body.classList.toggle("compact-ui", density === "compact");
  }, [state.form.appTheme, state.form.uiDensity]);

  const handleMobileTabChange = (tab: MobileTab) => {
    if (tab === "location") { setMobileLocationVisible(v => !v); setMobileDrawerOpen(false); return; }
    if (tab === mobileTab && mobileDrawerOpen) setMobileDrawerOpen(false);
    else { setMobileTab(tab); setMobileDrawerOpen(true); }
  };

  const handleDesktopTabChange = (tab: MobileTab) => {
    if (tab === desktopTab && desktopPanelOpen) setDesktopPanelOpen(false);
    else { setDesktopTab(tab); setDesktopPanelOpen(true); }
  };

  const handleMobileMarkerSize = useCallback((size: number) => {
    if (!activeMarker) return;
    dispatch({ type: "UPDATE_MARKER", markerId: activeMarker.id, changes: { size: Math.max(MIN_MARKER_SIZE, Math.min(MAX_MARKER_SIZE, Math.round(size))) } });
  }, [activeMarker, dispatch]);

  return (
    <div className="app-shell" data-mobile-tab={mobileTab} data-desktop-tab={desktopTab}>
      <DotField />
      <InstallPrompt />

      {!isMobileViewport
        ? <DesktopTopBar activeTab={desktopTab} panelOpen={desktopPanelOpen} onTabChange={handleDesktopTabChange} onAboutOpen={() => setAboutOpen(true)} />
        : <GeneralHeader onAboutOpen={() => setAboutOpen(true)} />}

      {isMobileViewport && (
        <div className={`mobile-location-row-wrap${mobileLocationVisible ? "" : " is-hidden"}`}>
          <DesktopLocationBar />
        </div>
      )}

      {isMobileViewport && isMarkerEditorActive && activeMarker && (
        <div className="mobile-marker-size-bar" role="group" aria-label={t("markerSize")}>
          <p className="mobile-marker-size-bar__label">{t("markerSize")}</p>
          <div className="mobile-marker-size-bar__controls">
            <input type="range" className="mobile-marker-size-bar__slider map-control-slider"
              min={MIN_MARKER_SIZE} max={MAX_MARKER_SIZE} step={1}
              value={Math.round(activeMarker.size)}
              onChange={e => handleMobileMarkerSize(Number(e.target.value))} />
            <span className="mobile-marker-size-bar__value">{Math.round(activeMarker.size)}px</span>
          </div>
        </div>
      )}

      {!isMobileViewport && (
        <div className="desktop-user-guide-panel">
          <Suspense fallback={null}><UserGuidePanel /></Suspense>
        </div>
      )}

      <div className="desktop-left-panel">
        <div className={`desktop-settings-slide${desktopPanelOpen ? " is-open" : ""}`}>
          <Suspense fallback={null}><SettingsPanel desktopActivePanel={desktopPanelOpen ? desktopTab : undefined} /></Suspense>
        </div>
      </div>

      <PreviewPanel />

      {mobileDrawerOpen && <SettingsDrawer mobileTab={mobileTab} onClose={() => setMobileDrawerOpen(false)} />}

      {isMobileViewport && isMarkerEditorActive && (
        <button type="button" className="mobile-marker-edit-done" onClick={() => {
          dispatch({ type: "SET_MARKER_EDITOR_ACTIVE", active: false });
          dispatch({ type: "SET_ACTIVE_MARKER", markerId: null });
          setMobileDrawerOpen(false);
        }}>
          <CheckIcon />
          <span>{t("doneEditing")}</span>
        </button>
      )}

      <MobileNavBar activeTab={mobileTab} drawerOpen={mobileDrawerOpen} isLocationVisible={mobileLocationVisible} onTabChange={handleMobileTabChange} />

      <FooterNote />
      <Suspense fallback={null}><AnnouncementModal /></Suspense>
      {aboutOpen && <Suspense fallback={null}><AboutModal onClose={() => setAboutOpen(false)} /></Suspense>}
      {supportPrompt && <SupportModal posterNumber={supportPrompt.posterNumber} variant={supportPrompt.variant} onClose={() => setSupportPrompt(null)} />}
    </div>
  );
}
