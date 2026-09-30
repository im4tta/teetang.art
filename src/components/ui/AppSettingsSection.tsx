import NewPosterButton from "@/components/ui/NewPosterButton";
import { SunIcon, MoonIcon, MaximizeIcon, MinimizeIcon, InfoIcon } from "@/components/ui/Icons";
import { useI18n } from "@/context/i18n/context";
import type { PosterForm } from "@/context/posterReducer";
import type { FormChangeHandler } from "@/hooks/useFormHandlers";

interface Props {
  form: PosterForm;
  onChange: FormChangeHandler;
  onAboutOpen?: () => void;
}

export default function AppSettingsSection({ form, onChange, onAboutOpen }: Props) {
  const { t } = useI18n();
  const opt = (
    name: string,
    value: string,
    Icon: React.ComponentType<{ className?: string }>,
    label: string,
  ) => (
    <button
      type="button"
      className={`settings-option-card${form[name] === value ? " is-active" : ""}`}
      onClick={() => onChange({ target: { name, value } })}
    >
      <Icon className="option-card-icon" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="app-settings-section">
      <div className="settings-group">
        <p className="section-summary-label">{t("settings.appearance")}</p>
        <div className="settings-row-grid">
          <div className="settings-option-card-group">
            {opt("appTheme", "light", SunIcon, t("settings.light"))}
            {opt("appTheme", "dark", MoonIcon, t("settings.dark"))}
          </div>
        </div>
      </div>
      <div className="settings-group" style={{ marginTop: 20 }}>
        <p className="section-summary-label">{t("settings.density")}</p>
        <div className="settings-row-grid">
          <div className="settings-option-card-group">
            {opt("uiDensity", "comfortable", MaximizeIcon, t("settings.comfortable"))}
            {opt("uiDensity", "compact", MinimizeIcon, t("settings.compact"))}
          </div>
        </div>
      </div>
      <div className="settings-group" style={{ marginTop: 20 }}>
        <p className="section-summary-label">{t("settings.poster")}</p>
        <div className="settings-link-grid">
          <NewPosterButton className="settings-link-btn" withLabel />
        </div>
      </div>
      {onAboutOpen && (
        <div className="settings-group" style={{ marginTop: 20 }}>
          <div className="settings-link-grid">
            <button type="button" className="settings-link-btn" onClick={onAboutOpen}>
              <InfoIcon />
              <span>{t("mnav.about")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
