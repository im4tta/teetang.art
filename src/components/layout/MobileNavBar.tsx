import { useEffect, useRef, useState } from "react";
import {
  LocationIcon,
  ThemeIcon,
  LayoutIcon,
  LayersIcon,
  MarkersIcon,
  RouteIcon,
  StyleIcon,
  GearIcon,
} from "@/components/ui/Icons";
import { MapPin } from "lucide-react";
import { useI18n } from "@/context/i18n/context";

export type MobileTab =
  | "settings"
  | "location"
  | "theme"
  | "layout"
  | "dualCity"
  | "style"
  | "layers"
  | "markers"
  | "routes";

const TABS: {
  id: MobileTab;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "location", labelKey: "nav.location", Icon: LocationIcon },
  { id: "theme", labelKey: "nav.theme", Icon: ThemeIcon },
  { id: "layout", labelKey: "nav.layout", Icon: LayoutIcon },
  { id: "dualCity", labelKey: "nav.dualCity", Icon: MapPin },
  { id: "style", labelKey: "nav.style", Icon: StyleIcon },
  { id: "layers", labelKey: "nav.layers", Icon: LayersIcon },
  { id: "markers", labelKey: "nav.markers", Icon: MarkersIcon },
  { id: "routes", labelKey: "nav.routes", Icon: RouteIcon },
  { id: "settings", labelKey: "nav.settings", Icon: GearIcon },
];

interface Props {
  activeTab: MobileTab;
  drawerOpen: boolean;
  isLocationVisible: boolean;
  onTabChange: (t: MobileTab) => void;
}

export default function MobileNavBar({
  activeTab,
  drawerOpen,
  isLocationVisible,
  onTabChange,
}: Props) {
  const { t } = useI18n();
  const tabsRef = useRef<HTMLDivElement>(null);
  const wasDrawerOpenRef = useRef(false);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const updateOverflow = () => {
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      setOverflow({ start: el.scrollLeft > 2, end: el.scrollLeft < maxScroll - 2 });
    };
    updateOverflow();
    el.addEventListener("scroll", updateOverflow, { passive: true });
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateOverflow);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (drawerOpen) {
      tabsRef.current
        ?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } else if (wasDrawerOpenRef.current) {
      tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`)?.focus();
    }
    wasDrawerOpenRef.current = drawerOpen;
  }, [activeTab, drawerOpen]);

  return (
    <div className="mobile-nav-wrapper">
      <nav className="mobile-nav" aria-label={t("nav.settings")}>
        <div className="mobile-nav-scroll-container">
          <div className="mobile-nav-tabs" ref={tabsRef}>
            {TABS.map(({ id, labelKey, Icon }) => {
              const isLoc = id === "location";
              const isActive = isLoc ? isLocationVisible : drawerOpen && activeTab === id;
              return (
                <button
                  key={id}
                  data-tab={id}
                  type="button"
                  className={`mobile-nav-tab${isActive ? " is-active" : ""}`}
                  onClick={() => onTabChange(id)}
                  aria-pressed={isLoc ? isLocationVisible : isActive}
                >
                  <Icon className="mobile-nav-icon" />
                  <span className="mobile-nav-label">{t(labelKey as any)}</span>
                </button>
              );
            })}
          </div>
          {overflow.start && (
            <div className="mobile-nav-fade mobile-nav-fade--start" aria-hidden="true" />
          )}
          {overflow.end && (
            <div className="mobile-nav-fade mobile-nav-fade--end" aria-hidden="true" />
          )}
        </div>
      </nav>
    </div>
  );
}
