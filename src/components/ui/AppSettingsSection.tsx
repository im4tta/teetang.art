import NewPosterButton from "@/components/ui/NewPosterButton";
import UndoRedoButtons from "@/components/ui/UndoRedoButtons";
import {
  SunIcon,
  MoonIcon,
  MaximizeIcon,
  MinimizeIcon,
  StyleIcon,
  LayoutIcon,
} from "@/components/ui/Icons";
import { useI18n } from "@/context/i18n/context";

interface Props {
  form: any;
  onChange: (e: any) => void;
}

export default function AppSettingsSection({ form, onChange }: Props) {
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

  const quickLinks: [string, React.ComponentType<{ className?: string }>, string][] = [
    ["style", StyleIcon, t("settings.fontsStyle")],
    ["layout", LayoutIcon, t("settings.shapesSizes")],
  ];

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
          <UndoRedoButtons className="settings-link-btn" withLabel />
          <NewPosterButton className="settings-link-btn" withLabel />
        </div>
      </div>
      <div className="settings-group" style={{ marginTop: 20 }}>
        <p className="section-summary-label">{t("settings.quickLinks")}</p>
        <div className="settings-links">
          <p className="settings-link-hint">{t("settings.jumpTo")}</p>
          <div className="settings-link-grid">
            {quickLinks.map(([sec, Icon, label]) => (
              <button
                key={sec}
                type="button"
                className="settings-link-btn"
                onClick={() =>
                  document
                    .querySelector(`[data-section="${sec}"]`)
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
