import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { InfoIcon } from "@/shared/ui/Icons";
import {
  ThemeIcon,
  LayoutIcon,
  LayersIcon,
  MarkersIcon,
  RouteIcon,
  StyleIcon,
} from "./Icons";
import type { MobileTab } from "./MobileNavBar";
import { useI18n } from "@/shared/i18n/context";
import DesktopLocationBar from "@/shared/ui/DesktopLocationBar";

interface DesktopTopBarProps {
  activeTab: MobileTab;
  panelOpen: boolean;
  onTabChange: (tab: MobileTab) => void;
  onAboutOpen: () => void;
}

const tabs: {
  id: MobileTab;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "theme", labelKey: "nav.theme", Icon: ThemeIcon },
  { id: "layout", labelKey: "nav.layout", Icon: LayoutIcon },
  { id: "dualCity", labelKey: "nav.dualCity", Icon: MapPin },
  { id: "style", labelKey: "nav.style", Icon: StyleIcon },
  { id: "layers", labelKey: "nav.layers", Icon: LayersIcon },
  { id: "markers", labelKey: "nav.markers", Icon: MarkersIcon },
  { id: "routes", labelKey: "nav.routes", Icon: RouteIcon },
];

export default function DesktopTopBar({
  activeTab,
  panelOpen,
  onTabChange,
  onAboutOpen,
}: DesktopTopBarProps) {
  const navigate = useNavigate();
  const { lang, toggleLang, t } = useI18n();

  return (
    <header className="desktop-top-bar">
      <div className="desktop-top-bar-main">
        <div className="desktop-top-bar-left">
          <div
            className="desktop-top-bar-brand"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: "#C0392B",
                border: "2px solid #D4AF37",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <MapPin size={18} />
            </div>
            <h1
              className="desktop-top-bar-title"
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 20,
                letterSpacing: "0.05em",
                color: "#F5F5FA",
              }}
            >
              TEE<span style={{ color: "#D4AF37" }}>TANG</span>.ART
            </h1>
          </div>
        </div>

        <nav className="desktop-top-bar-nav" aria-label={t("nav.settings")}>
          {tabs.map(({ id, labelKey, Icon }) => {
            const label = t(labelKey as any);
            return (
              <button
                key={id}
                type="button"
                className={`desktop-top-tab${panelOpen && activeTab === id ? " is-active" : ""}`}
                onClick={() => onTabChange(id)}
                title={label}
                aria-label={label}
                aria-current={panelOpen && activeTab === id ? "page" : undefined}
              >
                <Icon className="desktop-top-icon" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="desktop-top-bar-right">
          <div className="desktop-top-search">
            <DesktopLocationBar />
          </div>
          <button
            type="button"
            className="desktop-top-lang-btn"
            onClick={toggleLang}
            aria-label={lang === "en" ? "Switch to Khmer" : "ប្ដូរទៅអង់គ្លេស"}
            title={lang === "en" ? "ខ្មែរ" : "English"}
          >
            {lang === "en" ? "KH" : "EN"}
          </button>
          <button
            type="button"
            className="desktop-top-about-btn"
            onClick={onAboutOpen}
            aria-label={t("about.title")}
            title={t("about.title")}
          >
            <InfoIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
