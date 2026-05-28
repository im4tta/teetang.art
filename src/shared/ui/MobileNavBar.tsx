import { LocationIcon, ThemeIcon, LayoutIcon, LayersIcon, MarkersIcon, RouteIcon, StyleIcon } from "./Icons";
import { MapPin } from "lucide-react";
import { useI18n } from "@/shared/i18n/context";

export type MobileTab = "location" | "theme" | "layout" | "dualCity" | "style" | "layers" | "markers" | "routes";

const TABS: { id: MobileTab; labelKey: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "location", labelKey: "nav.location", Icon: LocationIcon },
  { id: "theme", labelKey: "nav.theme", Icon: ThemeIcon },
  { id: "layout", labelKey: "nav.layout", Icon: LayoutIcon },
  { id: "dualCity", labelKey: "nav.dualCity", Icon: MapPin },
  { id: "style", labelKey: "nav.style", Icon: StyleIcon },
  { id: "layers", labelKey: "nav.layers", Icon: LayersIcon },
  { id: "markers", labelKey: "nav.markers", Icon: MarkersIcon },
  { id: "routes", labelKey: "nav.routes", Icon: RouteIcon },
];

interface Props { activeTab: MobileTab; drawerOpen: boolean; isLocationVisible: boolean; onTabChange: (t: MobileTab) => void }

export default function MobileNavBar({ activeTab, drawerOpen, isLocationVisible, onTabChange }: Props) {
  const { t } = useI18n();
  return (
    <div className="mobile-nav-wrapper">
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <div className="mobile-nav-scroll-container">
          <div className="mobile-nav-tabs">
            {TABS.map(({ id, labelKey, Icon }) => {
              const isLoc = id === "location";
              const isActive = isLoc ? isLocationVisible : drawerOpen && activeTab === id;
              return (
                <button key={id} type="button" className={`mobile-nav-tab${isActive ? " is-active" : ""}`} onClick={() => onTabChange(id)}
                  aria-current={!isLoc && activeTab === id ? "page" : undefined}
                  aria-pressed={isLoc ? isLocationVisible : undefined}>
                  <Icon className="mobile-nav-icon" />
                  <span className="mobile-nav-label">{t(labelKey as any)}</span>
                </button>
              );
            })}
          </div>
          <div className="mobile-nav-fade" aria-hidden="true" />
        </div>
      </nav>
    </div>
  );
}
