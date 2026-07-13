import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { InfoIcon } from "@/components/ui/Icons";
import { useI18n } from "@/context/i18n/context";

interface GeneralHeaderProps {
  onAboutOpen: () => void;
}

function GlobeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      width="16"
      height="16"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export default function GeneralHeader({ onAboutOpen }: GeneralHeaderProps) {
  const navigate = useNavigate();
  const { lang, toggleLang, t } = useI18n();

  return (
    <header className="general-header">
      <div className="desktop-brand">
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
              color: "#F5F5FA",
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
        <button
          type="button"
          className="lang-toggle"
          onClick={toggleLang}
          aria-label={lang === "en" ? "Switch to Khmer" : "ប្ដូរទៅអង់គ្លេស"}
          title={lang === "en" ? "ខ្មែរ" : "English"}
        >
          <GlobeIcon />
          <span>{lang === "en" ? "KH" : "EN"}</span>
        </button>
        <button
          type="button"
          className="general-header-text-btn general-header-about-text-btn"
          onClick={onAboutOpen}
          aria-label={t("about.title")}
          title={t("about.title")}
        >
          <span className="general-header-btn-label">{t("about.title")}</span>
          <span className="general-header-btn-icon" aria-hidden="true">
            <InfoIcon />
          </span>
        </button>
      </div>
    </header>
  );
}
