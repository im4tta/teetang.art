import {
  LocationIcon,
  ThemeIcon,
  LayoutIcon,
  LayersIcon,
  MarkersIcon,
  RouteIcon,
  StyleIcon,
  SettingsIcon,
} from "./Icons";
import type { MobileTab } from "./MobileNavBar";
import { useI18n } from "@/shared/i18n/context";

const tabs: {
  id: MobileTab;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "theme", labelKey: "nav.theme", Icon: ThemeIcon },
  { id: "layout", labelKey: "nav.layout", Icon: LayoutIcon },
  { id: "style", labelKey: "nav.style", Icon: StyleIcon },
  { id: "layers", labelKey: "nav.layers", Icon: LayersIcon },
  { id: "markers", labelKey: "nav.markers", Icon: MarkersIcon },
  { id: "routes", labelKey: "nav.routes", Icon: RouteIcon },
];

interface DesktopNavBarProps {
  activeTab: MobileTab;
  panelOpen: boolean;
  onTabChange: (tab: MobileTab) => void;
  isLocationVisible: boolean;
  onLocationToggle: () => void;
}

export default function DesktopNavBar({
  activeTab,
  panelOpen,
  onTabChange,
  isLocationVisible,
  onLocationToggle,
}: DesktopNavBarProps) {
  const { t } = useI18n();
  return (
    <nav className="desktop-nav-bar" aria-label={t("nav.settings")}>
      <button
        type="button"
        className={`desktop-nav-tab${isLocationVisible ? " is-active" : ""}`}
        onClick={onLocationToggle}
        title={isLocationVisible ? t("nav.hideLocationRow") : t("nav.showLocationRow")}
        aria-label={isLocationVisible ? t("nav.hideLocationRow") : t("nav.showLocationRow")}
        aria-pressed={isLocationVisible}
      >
        <LocationIcon className="desktop-nav-icon" />
        <span className="desktop-nav-label">{t("nav.location")}</span>
      </button>

      {tabs.map(({ id, labelKey, Icon }) => {
        const label = t(labelKey as any);
        return (
          <button
            key={id}
            type="button"
            className={`desktop-nav-tab${panelOpen && activeTab === id ? " is-active" : ""}`}
            onClick={() => onTabChange(id)}
            title={label}
            aria-label={label}
            aria-current={panelOpen && activeTab === id ? "page" : undefined}
          >
            <Icon className="desktop-nav-icon" />
            <span className="desktop-nav-label">{label}</span>
          </button>
        );
      })}

      <button
        type="button"
        className={`desktop-nav-tab desktop-nav-tab--settings${panelOpen && (activeTab as string) === "app" ? " is-active" : ""}`}
        onClick={() => onTabChange("app" as any)}
        title={t("nav.settings")}
        aria-label={t("nav.settings")}
        aria-current={panelOpen && (activeTab as string) === "app" ? "page" : undefined}
      >
        <SettingsIcon className="desktop-nav-icon" />
        <span className="desktop-nav-label">{t("nav.settings")}</span>
      </button>
    </nav>
  );
}
