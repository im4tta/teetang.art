import { useNavigate } from "react-router-dom";
import { MapPin, Settings } from "lucide-react";
import UndoRedoButtons from "@/components/ui/UndoRedoButtons";
import { useI18n } from "@/context/i18n/context";

interface GeneralHeaderProps {
  onSettingsOpen: () => void;
}

export default function GeneralHeader({ onSettingsOpen }: GeneralHeaderProps) {
  const navigate = useNavigate();
  const { lang, toggleLang, t } = useI18n();

  return (
    <header className="general-header">
      <div className="desktop-brand">
        <div
          className="general-header-logo"
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
        <div
          className="desktop-brand-copy brand-copy"
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          <h1
            className="desktop-brand-title"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 18,
              letterSpacing: "0.05em",
              color: "var(--ink)",
              margin: 0,
              lineHeight: 1,
            }}
          >
            TEE<span style={{ color: "#D4AF37" }}>TANG</span>.ART
          </h1>
          <p
            className="desktop-brand-kicker app-kicker"
            style={{ margin: "2px 0 0", fontSize: 11 }}
          >
            {t("app.tagline")}
          </p>
        </div>
      </div>

      <div className="general-header-actions">
        <UndoRedoButtons className="general-header-icon-btn" />
        <button
          type="button"
          className="lang-toggle general-header-icon-btn"
          onClick={toggleLang}
          aria-label={lang === "en" ? "Switch to Khmer" : "ប្ដូរទៅអង់គ្លេស"}
          title={lang === "en" ? "ខ្មែរ" : "English"}
        >
          <span>{lang === "en" ? "KH" : "EN"}</span>
        </button>
        <button
          type="button"
          className="general-header-icon-btn"
          onClick={onSettingsOpen}
          aria-label={t("nav.settings")}
          title={t("nav.settings")}
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
