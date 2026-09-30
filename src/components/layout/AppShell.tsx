import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { useSearchParams } from "react-router-dom";
import { usePosterContext } from "@/context/PosterContext";
import { useI18n } from "@/context/i18n/context";
import { geocodeLocation } from "@/services/container";
import { parsePosterLink } from "@/services/share/posterLink";
import { getLayoutOption } from "@/services/layout/layoutRepository";
import { formatLayoutCm } from "@/services/layout/layoutMatcher";
import { MAX_MARKER_SIZE, MIN_MARKER_SIZE } from "@/services/markers/constants";
import GeneralHeader from "@/components/layout/GeneralHeader";
import DesktopTopBar from "@/components/layout/DesktopTopBar";
import FooterNote from "@/components/layout/FooterNote";
import PreviewPanel from "@/components/ui/PreviewPanel";
import MobileNavBar, {
  type MobileNavTarget,
  type MobileTab,
} from "@/components/layout/MobileNavBar";
import {
  MOBILE_GROUPS,
  OPEN_EXPORT_EVENT,
  type MobileGroup,
} from "@/components/layout/mobileGroups";
import { tapFeedback } from "@/utils/haptics";
import InstallPrompt from "@/components/ui/InstallPrompt";
import { useSwipeDown } from "@/hooks/useSwipeDown";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { CheckIcon } from "@/components/ui/Icons";
import SupportModal from "@/components/ui/SupportModal";
import { SUPPORT_PROMPT_EVENT, type SupportPromptState } from "@/services/export/supportPrompt";
import DotField from "@/components/layout/DotField";
import DesktopLocationBar from "@/components/layout/DesktopLocationBar";
import { useUndoShortcuts } from "@/hooks/useUndoShortcuts";
import Toaster from "@/components/ui/Toaster";
import QuickStart from "@/components/ui/QuickStart";
import { notify } from "@/services/notify";

const AboutModal = lazy(() => import("@/components/ui/AboutModal"));
const SettingsPanel = lazy(() => import("@/components/ui/SettingsPanel"));
const AnnouncementModal = lazy(() => import("@/components/ui/AnnouncementModal"));
const UserGuidePanel = lazy(() => import("@/components/ui/UserGuidePanel"));

type SheetSnap = "peek" | "half" | "full";
const SNAPS: SheetSnap[] = ["peek", "half", "full"];

function SettingsDrawer({
  group,
  onClose,
  onAboutOpen,
}: {
  group: MobileGroup;
  onClose: () => void;
  onAboutOpen: () => void;
}) {
  const { t } = useI18n();
  // Style opens low so the poster stays visible while swiping through themes.
  const [snap, setSnap] = useState<SheetSnap>(group === "look" ? "peek" : "half");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const step = (delta: number) => {
    const next = SNAPS.indexOf(snap) + delta;
    if (next < 0) onClose();
    else setSnap(SNAPS[Math.min(next, SNAPS.length - 1)]);
  };
  const { sheetRef, handleRef, handleProps } = useSwipeDown(() => step(-1), 60, {
    onExpand: () => step(1),
  });

  useFocusTrap(sheetRef, onClose);
  // Focus the close button once when the drawer opens; re-running this on
  // every render would pull focus out of the field being typed in.
  useEffect(() => closeButtonRef.current?.focus(), []);

  useEffect(() => {
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(".app-shell > :not(.mobile-drawer)"),
    );
    background.forEach((element) => {
      element.setAttribute("aria-hidden", "true");
      (element as HTMLElement & { inert: boolean }).inert = true;
    });
    return () => {
      background.forEach((element) => {
        element.removeAttribute("aria-hidden");
        (element as HTMLElement & { inert: boolean }).inert = false;
      });
    };
  }, []);

  return (
    <div className="mobile-drawer" data-snap={snap}>
      <div className="mobile-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className={`mobile-drawer-sheet${snap === "full" ? " is-expanded" : ""}`}
        ref={sheetRef}
        data-snap={snap}
        data-mobile-group={group}
        role="dialog"
        aria-modal="true"
        aria-label={t(MOBILE_GROUPS[group].labelKey)}
      >
        <div className="mobile-drawer-toolbar">
          <button
            ref={handleRef}
            type="button"
            className="mobile-drawer-handle"
            onClick={() => setSnap(SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length])}
            aria-label={t("sheet.resize")}
            {...handleProps}
          >
            <span className="mobile-drawer-grabber" aria-hidden="true" />
          </button>
          <button
            ref={closeButtonRef}
            type="button"
            className="mobile-drawer-close"
            onClick={onClose}
            aria-label={t("sheet.close")}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="mobile-drawer-content">
          <Suspense fallback={null}>
            <SettingsPanel mobileGroup={group} onAboutOpen={onAboutOpen} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  const { t } = useI18n();
  const { state, dispatch } = usePosterContext();
  useUndoShortcuts();

  // Errors used to appear only inside the settings panel, invisible on phones
  // with the drawer closed; surface them as toasts too.
  useEffect(() => {
    if (state.error) notify(state.error, { tone: "error", id: "poster-error" });
  }, [state.error]);

  useEffect(() => {
    const offline = () => notify(t("toast.offline"), { id: "network", duration: 0 });
    const online = () => notify(t("toast.online"), { id: "network", tone: "success" });
    if (!navigator.onLine) offline();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [t]);

  const { isMarkerEditorActive } = state;
  const activeMarker =
    state.activeMarkerId != null
      ? (state.markers.find((m) => m.id === state.activeMarkerId) ?? null)
      : null;

  const [mobileGroup, setMobileGroup] = useState<MobileGroup>("look");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const isMobileViewport = useMobileViewport();
  const [desktopTab, setDesktopTab] = useState<MobileTab>("theme");
  const [desktopPanelOpen, setDesktopPanelOpen] = useState(false);
  const [desktopPanelMounted, setDesktopPanelMounted] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [supportPrompt, setSupportPrompt] = useState<SupportPromptState | null>(null);

  // Apply a shared /create?… link once, then drop it from the address bar so a
  // later refresh reopens the saved draft instead of re-applying the link.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const link = parsePosterLink(searchParams);
    if (!link) return;
    setSearchParams({}, { replace: true });
    if (link.theme) dispatch({ type: "SET_THEME", themeId: link.theme });
    const layout = link.layout ? getLayoutOption(link.layout) : null;
    if (layout) {
      dispatch({
        type: "SET_LAYOUT",
        layoutId: layout.id,
        widthCm: formatLayoutCm(layout.widthCm),
        heightCm: formatLayoutCm(layout.heightCm),
      });
    }
    const { displayCity, displayCountry, ...fields } = link.fields;
    if (Object.keys(fields).length) {
      dispatch({ type: "SET_FORM_FIELDS", fields, resetDisplayNameOverrides: true });
    }
    // Set titles as user edits so reverse geocoding the new spot keeps them.
    if (displayCity) dispatch({ type: "SET_FIELD", name: "displayCity", value: displayCity });
    if (displayCountry)
      dispatch({ type: "SET_FIELD", name: "displayCountry", value: displayCountry });
    const query = link.geocodeQuery;
    if (query) {
      geocodeLocation(query)
        .then((location) => dispatch({ type: "SELECT_LOCATION", location }))
        .catch(() =>
          dispatch({
            type: "SET_FORM_FIELDS",
            fields: { displayCity: query, displayCountry: "Cambodia" },
          }),
        );
    }
  }, [searchParams, setSearchParams, dispatch]);

  useEffect(() => {
    const handler = (e: Event) => setSupportPrompt((e as CustomEvent<SupportPromptState>).detail);
    window.addEventListener(SUPPORT_PROMPT_EVENT, handler);
    return () => window.removeEventListener(SUPPORT_PROMPT_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const prev = {
      bO: document.body.style.overflow,
      hO: document.documentElement.style.overflow,
      bS: document.body.style.overscrollBehavior,
      hS: document.documentElement.style.overscrollBehavior,
    };
    document.body.style.overflow = document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = document.documentElement.style.overscrollBehavior =
      "none";
    return () => {
      document.body.style.overflow = prev.bO;
      document.documentElement.style.overflow = prev.hO;
      document.body.style.overscrollBehavior = prev.bS;
      document.documentElement.style.overscrollBehavior = prev.hS;
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    const theme = state.form.appTheme || "dark";
    const density = state.form.uiDensity || "comfortable";
    document.documentElement.setAttribute("data-app-theme", theme);
    document.documentElement.setAttribute("data-ui-density", density);
    document.documentElement.classList.toggle("light-theme", theme === "light");
    document.body.classList.toggle("light-theme", theme === "light");
    document.body.classList.toggle("compact-ui", density === "compact");
  }, [state.form.appTheme, state.form.uiDensity]);

  const openMobileGroup = (group: MobileGroup) => {
    tapFeedback();
    if (group === mobileGroup && mobileDrawerOpen) {
      setMobileDrawerOpen(false);
      return;
    }
    setMobileGroup(group);
    setMobileDrawerOpen(true);
  };

  const handleMobileNav = (target: MobileNavTarget) => {
    if (target === "download") {
      tapFeedback();
      setMobileDrawerOpen(false);
      window.dispatchEvent(new Event(OPEN_EXPORT_EVENT));
      return;
    }
    openMobileGroup(target);
  };

  const handleDesktopTabChange = (tab: MobileTab) => {
    if (tab === desktopTab && desktopPanelOpen) setDesktopPanelOpen(false);
    else {
      setDesktopTab(tab);
      setDesktopPanelMounted(true);
      setDesktopPanelOpen(true);
    }
  };

  const handleMobileMarkerSize = useCallback(
    (size: number) => {
      if (!activeMarker) return;
      dispatch({
        type: "UPDATE_MARKER",
        markerId: activeMarker.id,
        changes: { size: Math.max(MIN_MARKER_SIZE, Math.min(MAX_MARKER_SIZE, Math.round(size))) },
      });
    },
    [activeMarker, dispatch],
  );

  return (
    <div
      className="app-shell"
      data-desktop-tab={desktopTab}
      data-desktop-panel-open={desktopPanelOpen ? "true" : "false"}
    >
      <DotField />
      <InstallPrompt />

      {!isMobileViewport ? (
        <DesktopTopBar
          activeTab={desktopTab}
          panelOpen={desktopPanelOpen}
          onTabChange={handleDesktopTabChange}
          onAboutOpen={() => setAboutOpen(true)}
        />
      ) : (
        <GeneralHeader onSettingsOpen={() => openMobileGroup("settings")} />
      )}

      {isMobileViewport && (
        <div className="mobile-location-row-wrap">
          <DesktopLocationBar />
        </div>
      )}

      {isMobileViewport && isMarkerEditorActive && activeMarker && (
        <div className="mobile-marker-size-bar" role="group" aria-label={t("markerSize")}>
          <label className="mobile-marker-size-bar__label" htmlFor="mobile-marker-size">
            {t("markerSize")}
          </label>
          <div className="mobile-marker-size-bar__controls">
            <input
              id="mobile-marker-size"
              type="range"
              className="mobile-marker-size-bar__slider map-control-slider"
              min={MIN_MARKER_SIZE}
              max={MAX_MARKER_SIZE}
              step={1}
              value={Math.round(activeMarker.size)}
              onChange={(e) => handleMobileMarkerSize(Number(e.target.value))}
            />
            <span className="mobile-marker-size-bar__value">{Math.round(activeMarker.size)}px</span>
          </div>
        </div>
      )}

      {!isMobileViewport && (
        <div className="desktop-user-guide-panel">
          <Suspense fallback={null}>
            <UserGuidePanel />
          </Suspense>
        </div>
      )}

      <div id="desktop-settings-panel" className="desktop-left-panel">
        <div className={`desktop-settings-slide${desktopPanelOpen ? " is-open" : ""}`}>
          {desktopPanelMounted && (
            <Suspense fallback={null}>
              <SettingsPanel desktopActivePanel={desktopPanelOpen ? desktopTab : undefined} />
            </Suspense>
          )}
        </div>
      </div>

      <PreviewPanel />

      {mobileDrawerOpen && (
        <SettingsDrawer
          key={mobileGroup}
          group={mobileGroup}
          onClose={() => setMobileDrawerOpen(false)}
          onAboutOpen={() => {
            setMobileDrawerOpen(false);
            setAboutOpen(true);
          }}
        />
      )}

      {isMobileViewport && isMarkerEditorActive && (
        <button
          type="button"
          className="mobile-marker-edit-done"
          onClick={() => {
            dispatch({ type: "SET_MARKER_EDITOR_ACTIVE", active: false });
            dispatch({ type: "SET_ACTIVE_MARKER", markerId: null });
            setMobileDrawerOpen(false);
          }}
        >
          <CheckIcon />
          <span>{t("doneEditing")}</span>
        </button>
      )}

      <MobileNavBar
        activeGroup={mobileDrawerOpen ? mobileGroup : null}
        onSelect={handleMobileNav}
      />

      {/* On phones the footer lives in the Settings sheet, clear of the tab bar. */}
      {!isMobileViewport && <FooterNote />}
      <Toaster />
      {isMobileViewport && <QuickStart />}
      <Suspense fallback={null}>
        <AnnouncementModal />
      </Suspense>
      {aboutOpen && (
        <Suspense fallback={null}>
          <AboutModal onClose={() => setAboutOpen(false)} />
        </Suspense>
      )}
      {supportPrompt && (
        <SupportModal
          posterNumber={supportPrompt.posterNumber}
          variant={supportPrompt.variant}
          onClose={() => setSupportPrompt(null)}
        />
      )}
    </div>
  );
}
